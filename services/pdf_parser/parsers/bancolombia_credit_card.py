"""Bancolombia Tarjeta de Crédito (credit card) PDF parser.

Parses digital Bancolombia credit card statements.
Uses dedupe_chars() to fix the triple-character anti-copy encoding.
A single PDF can contain multiple currency sections (COP + USD).
Number format: Colombian style (period = thousands, comma = decimal) e.g. 1.234.567,89
Date format in table: DD/MM/YYYY
"""

from __future__ import annotations

import re
from datetime import date

import pdfplumber

from models import (
    CreditCardMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

# --- Spanish month mapping ---
SPANISH_MONTHS: dict[str, int] = {
    "ene": 1,
    "feb": 2,
    "mar": 3,
    "abr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dic": 12,
}

# --- Regex patterns ---

CARD_NUMBER_RE = re.compile(r"Tarjeta:\s*\*+(\d{4})")
CURRENCY_RE = re.compile(r"Moneda:\s*(PESOS|DOLARES|DÓLARES)", re.IGNORECASE)
ESTADO_CURRENCY_RE = re.compile(
    r"ESTADO DE CUENTA EN\s*:\s*(PESOS|DOLARES|DÓLARES)", re.IGNORECASE
)
# Period pattern: "31 ago - 30 sep. 2025" (standalone, not requiring "Periodo facturado")
PERIOD_DATE_RE = re.compile(
    r"(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?"
    r"\s*[-–]\s*"
    r"(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?"
    r"\s+(\d{4})",
    re.IGNORECASE,
)
TX_DATE_RE = re.compile(r"(\d{2}/\d{2}/\d{4})")
COLOMBIAN_NUM_START_RE = re.compile(r"^(-?[\d.,]+)")

# --- Credit card metadata patterns ---
# Single-line: "Cupo total: $ 5.000.000,00"
CUPO_TOTAL_RE = re.compile(
    r"Cupo\s+total\s*:?\s*\$\s*([\d.,]+)", re.IGNORECASE
)
# Single-line: "Disponible: $ 922.773,50"
CUPO_DISPONIBLE_RE = re.compile(
    r"Disponible\s*:?\s*\$\s*([\d.,]+)", re.IGNORECASE
)
# Summary: "+ Saldo anterior $ 4.486.240,92"
SALDO_ANTERIOR_RE = re.compile(
    r"Saldo\s+anterior\s*\$\s*([\d.,]+)", re.IGNORECASE
)
# Summary: "+ Compras del mes $ 1.014.417,00"
COMPRAS_MES_RE = re.compile(
    r"Compras\s+del\s+mes\s*\$\s*([\d.,]+)", re.IGNORECASE
)
# Summary: "+ Intereses corrientes $ 17.879,57"
INTERESES_CORRIENTES_RE = re.compile(
    r"Intereses\s+corrientes\s*\$\s*([\d.,]+)", re.IGNORECASE
)
# Interest rate table: "Compra 2 - 36 cuotas 1.8311% 24.3269%"
# or "Compra Internacional 1.8311% 24.3269%"
# Note: rates use US format (period as decimal)
TASA_COMPRA_RE = re.compile(
    r"Compra\s+(?:2\s*-\s*36\s+cuotas|Internacional)\s+([\d.]+)%\s+([\d.]+)%"
)
# "Mora 1.8311% 24.3269%"
TASA_MORA_RE = re.compile(r"Mora\s+([\d.]+)%\s+([\d.]+)%")
# Payment date: "feb. 16, 2026" (standalone on a line)
PAGAR_ANTES_DATE_RE = re.compile(
    r"(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s+(\d{1,2}),?\s+(\d{4})",
    re.IGNORECASE,
)
# Last $ value on a line: captures the last "$ NNN" occurrence
LAST_DOLLAR_VALUE_RE = re.compile(r"\$\s*([\d.,]+)(?!.*\$)")

# Lines to skip
SKIP_PATTERNS = [
    "DCF:defensor",
    "autorización",
    "pendiente",
    "Couta/Abono",
    "Recuerda estar",
    "débitos a tus cuentas",
]


def _parse_colombian_number(s: str) -> float:
    """Parse Colombian-formatted number: 1.234.567,89 → 1234567.89"""
    s = s.replace("$", "").replace(" ", "").replace("%", "").strip()
    if not s or s == "-":
        return 0.0
    s = s.replace(".", "").replace(",", ".")
    return float(s)


def _currency_label_to_code(label: str) -> str:
    label = label.upper().strip()
    if label == "PESOS":
        return "COP"
    if label in ("DOLARES", "DÓLARES"):
        return "USD"
    return label


def _detect_currency(text: str) -> str | None:
    match = CURRENCY_RE.search(text)
    if match:
        return _currency_label_to_code(match.group(1))
    match = ESTADO_CURRENCY_RE.search(text)
    if match:
        return _currency_label_to_code(match.group(1))
    return None


def _parse_period(text: str) -> tuple[date | None, date | None]:
    """Extract period from text like '31 ago - 30 sep. 2025'."""
    match = PERIOD_DATE_RE.search(text)
    if not match:
        return None, None

    from_day = int(match.group(1))
    from_month = SPANISH_MONTHS.get(match.group(2).lower().rstrip("."), 0)
    to_day = int(match.group(3))
    to_month = SPANISH_MONTHS.get(match.group(4).lower().rstrip("."), 0)
    year = int(match.group(5))

    if not from_month or not to_month:
        return None, None

    from_year = year if from_month <= to_month else year - 1
    return date(from_year, from_month, from_day), date(year, to_month, to_day)


def _should_skip_line(line: str) -> bool:
    return any(pat in line for pat in SKIP_PATTERNS)


def _parse_transaction_line(
    line: str, currency: str
) -> ParsedTransaction | None:
    """Parse a single transaction line from credit card detail text.

    Lines look like:
      T00265 29/09/2025 DLO*GOOGLE Archero $ 66.000,00 1/1 $ 66.000,00 0,0000 % 00,0000 % $ 0,00
      30/09/2025 INTERESES CORRIENTES $ 31.761,22 $ 31.761,22 $ 0,00
    """
    date_match = TX_DATE_RE.search(line)
    if not date_match:
        return None

    # Auth number is everything before the date
    auth_num = line[: date_match.start()].strip() or None

    # Everything after the date: description + $ amounts
    after_date = line[date_match.end() :].strip()

    # Split by '$' — first part is description, rest are amounts
    dollar_parts = after_date.split("$")
    if len(dollar_parts) < 2:
        return None

    description = dollar_parts[0].strip()
    if not description:
        return None

    # First $ amount = valor movimiento (may have installments after it)
    first_part = dollar_parts[1].strip()
    num_match = COLOMBIAN_NUM_START_RE.match(first_part)
    if not num_match:
        return None

    try:
        amount = _parse_colombian_number(num_match.group(1))
    except ValueError:
        return None

    # Check for installments (e.g. "1/1", "1/24") after the amount
    rest = first_part[num_match.end() :].strip()
    installments = None
    inst_match = re.match(r"(\d+/\d+)", rest)
    if inst_match:
        installments = inst_match.group(1)

    # Last $ amount = saldo pendiente
    balance = None
    last_part = dollar_parts[-1].strip()
    try:
        balance = _parse_colombian_number(last_part)
    except ValueError:
        pass

    # Parse date DD/MM/YYYY
    try:
        parts = date_match.group(1).split("/")
        tx_date = date(int(parts[2]), int(parts[1]), int(parts[0]))
    except (ValueError, IndexError):
        return None

    direction = (
        TransactionDirection.INFLOW if amount < 0 else TransactionDirection.OUTFLOW
    )

    return ParsedTransaction(
        date=tx_date,
        description=description,
        amount=abs(amount),
        direction=direction,
        balance=balance,
        currency=currency,
        authorization_number=auth_num,
        installments=installments,
    )


def _extract_metadata(
    page_texts: list[str],
) -> tuple[CreditCardMetadata, StatementSummary]:
    """Extract credit card metadata and summary from page texts.

    Bancolombia credit card PDFs have a two-column layout that pdfplumber
    flattens. Key values like "Pago Total:" and "Pago mínimo:" appear at
    the END of a line, with their $ values on the NEXT line(s). We use a
    state machine tracking the previous line to handle this.
    """
    meta: dict = {}
    summary: dict = {}

    for text in page_texts:
        lines = text.split("\n")
        prev_line = ""

        for line in lines:
            stripped = line.strip()

            # --- Single-line patterns ---

            if not meta.get("credit_limit"):
                m = CUPO_TOTAL_RE.search(stripped)
                if m:
                    meta["credit_limit"] = _parse_colombian_number(m.group(1))

            if not meta.get("available_credit"):
                m = CUPO_DISPONIBLE_RE.search(stripped)
                if m:
                    meta["available_credit"] = _parse_colombian_number(m.group(1))

            if not summary.get("previous_balance"):
                m = SALDO_ANTERIOR_RE.search(stripped)
                if m:
                    summary["previous_balance"] = _parse_colombian_number(m.group(1))

            if not summary.get("purchases_and_charges"):
                m = COMPRAS_MES_RE.search(stripped)
                if m:
                    summary["purchases_and_charges"] = _parse_colombian_number(
                        m.group(1)
                    )

            if not summary.get("interest_charged"):
                m = INTERESES_CORRIENTES_RE.search(stripped)
                if m:
                    summary["interest_charged"] = _parse_colombian_number(m.group(1))

            # Interest rate table rows (US-format numbers: 1.8311%)
            if not meta.get("interest_rate"):
                m = TASA_COMPRA_RE.search(stripped)
                if m:
                    rate = float(m.group(1))
                    if rate > 0:
                        meta["interest_rate"] = rate

            if not meta.get("late_interest_rate"):
                m = TASA_MORA_RE.search(stripped)
                if m:
                    meta["late_interest_rate"] = float(m.group(1))

            # --- State-machine: values on the line AFTER their label ---

            # "Pago Total:" ends the previous line → last $ on this line
            if not meta.get("total_payment_due") and "Pago Total:" in prev_line:
                m = LAST_DOLLAR_VALUE_RE.search(stripped)
                if m:
                    meta["total_payment_due"] = _parse_colombian_number(m.group(1))

            # "Pagar antes de:" + "Pago mínimo:" on prev_prev line →
            # payment date + minimum payment are 2 lines later.
            # But we also check: line has "mes. DD, YYYY $ NNN" format
            if not meta.get("payment_due_date"):
                m = PAGAR_ANTES_DATE_RE.search(stripped)
                if m:
                    month_str = m.group(1).lower().rstrip(".")
                    month = SPANISH_MONTHS.get(month_str, 0)
                    if month:
                        day = int(m.group(2))
                        year = int(m.group(3))
                        meta["payment_due_date"] = date(year, month, day)

                    # Minimum payment is the last $ value on this same line
                    if not meta.get("minimum_payment"):
                        mv = LAST_DOLLAR_VALUE_RE.search(stripped)
                        if mv:
                            meta["minimum_payment"] = _parse_colombian_number(
                                mv.group(1)
                            )

            prev_line = stripped

    # total_payment_due doubles as final_balance for credit cards
    if meta.get("total_payment_due"):
        summary.setdefault("final_balance", meta["total_payment_due"])

    return CreditCardMetadata(**meta), StatementSummary(**summary)


def parse_credit_card(pdf_path: str) -> list[ParsedStatement]:
    """Parse a Bancolombia credit card PDF.

    Returns multiple statements if the PDF has multiple currency sections.
    """
    # Dedupe all pages and extract clean text
    page_texts: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            deduped = page.dedupe_chars()
            text = deduped.extract_text() or ""
            page_texts.append(text)

    # Group pages by currency section
    sections: dict[str, dict] = {}
    current_currency: str | None = None
    card_last_four: str | None = None

    for text in page_texts:
        # Card number
        if not card_last_four:
            card_match = CARD_NUMBER_RE.search(text)
            if card_match:
                card_last_four = card_match.group(1)

        # Detect currency
        page_currency = _detect_currency(text)
        if page_currency:
            current_currency = page_currency
            if current_currency not in sections:
                period_from, period_to = _parse_period(text)
                sections[current_currency] = {
                    "texts": [],
                    "period_from": period_from,
                    "period_to": period_to,
                }

        if current_currency and current_currency in sections:
            sections[current_currency]["texts"].append(text)

    # Parse each currency section
    results: list[ParsedStatement] = []

    for currency, section in sections.items():
        transactions: list[ParsedTransaction] = []
        in_tx_section = False

        for text in section["texts"]:
            for line in text.split("\n"):
                line_stripped = line.strip()

                # Detect transaction section boundaries
                if "Nuevos movimientos" in line or "Movimientos antes" in line:
                    in_tx_section = True
                    continue

                if not in_tx_section:
                    continue

                if _should_skip_line(line_stripped):
                    continue

                # Empty line
                if not line_stripped:
                    continue

                # Try to parse as transaction
                tx = _parse_transaction_line(line_stripped, currency)
                if tx:
                    transactions.append(tx)

        cc_metadata, summary = _extract_metadata(section["texts"])

        results.append(
            ParsedStatement(
                statement_type=StatementType.CREDIT_CARD,
                card_last_four=card_last_four,
                period_from=section["period_from"],
                period_to=section["period_to"],
                currency=currency,
                summary=summary,
                credit_card_metadata=cc_metadata,
                transactions=transactions,
            )
        )

    return results
