"""Falabella (CMR) Credit Card PDF parser.

Parses Banco Falabella CMR credit card statements.
Number format: Colombian style (period = thousands, comma = decimal) e.g. 1.234.567,89
Date format in table: DD/MM/YYYY

NOTE: This PDF renders some text in overlapping layers, causing pdfplumber to extract
every character twice consecutively (e.g. "CCMMRR" instead of "CMR", "TT" instead of
"T"). The _normalize_line() function detects and collapses fully-doubled tokens before
regex matching.
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

from parsers.utils import SPANISH_MONTHS

# --- Text normalisation helpers ---

def _dedup_token(token: str) -> str:
    """Collapse a token if every adjacent character pair is identical.

    e.g. "CCMMRR" -> "CMR", "TT" -> "T", "$$332288" -> "$328"
    Leaves tokens with any non-paired characters unchanged so that
    legitimate repeated chars like '00' inside '1.969.900,00' are safe
    (they appear as part of a longer token that is NOT fully doubled).
    """
    n = len(token)
    if n >= 2 and n % 2 == 0 and all(token[i] == token[i + 1] for i in range(0, n, 2)):
        return token[::2]
    return token


def _normalize_line(line: str) -> str:
    """Normalize a PDF line by deduplicating doubled tokens.

    Splits on whitespace (preserving spacing), deduplicates each
    non-whitespace token independently, then reassembles.
    """
    parts = re.split(r"(\s+)", line)
    return "".join(_dedup_token(p) for p in parts)


# --- Regex patterns (applied AFTER _normalize_line) ---

# After normalization "****" (4 stars) collapses to "**" (2 stars), so match 1+ stars.
# e.g. "09** ** 3431" → capture "3431"
CARD_NUMBER_RE = re.compile(r"\*+\s+(\d{4})\b")

# After normalization: "05 ene 2026 - 04 feb 2026" (on its own line)
PERIOD_RE = re.compile(
    r"^(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s*-+\s*(\d{1,2})\s+([a-z]{3})\s+(\d{4})$",
    re.IGNORECASE,
)

# "Paga antes del" appears alone on one line; the date ("20 FEB 2026") is on the next.
# We use a two-step flag: detect the label line, then parse the following date line.
PAGA_ANTES_DEL_RE = re.compile(r"Paga\s+antes\s+del", re.IGNORECASE)
PAYMENT_DUE_DATE_LINE_RE = re.compile(r"^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$")

# Interest charged: "Intereses corrientes: 46.240,30"
INTEREST_CHARGED_RE = re.compile(r"Intereses\s+corrientes:\s*([\d.,]+)", re.IGNORECASE)

# Summary section (mixed — some lines are not doubled)
CUPO_TOTAL_RE = re.compile(r"Cupo\s+total\s+de\s+tu\s+Tarjeta:\s*\$\s*([\d.,]+)")
# "Has utilizado" = credit used = total payment due
USED_RE = re.compile(r"Has\s+utilizado:\s*\$\s*([\d.,]+)")
AVAILABLE_RE = re.compile(r"Tienes\s+disponible:\s*\$\s*([\d.,]+)")
MIN_PAYMENT_RE = re.compile(r"Tu\s+pago\s+m[ií]nimo\s+es:\s*\$\s*([\d.,]+)")
TOTAL_PAYMENT_RE = re.compile(r"Tu\s+pago\s+total\s+es:\s*\$\s*([\d.,]+)")

# Transaction line (after normalization type flag is single char: T or A)
# 14/10/2025 FALABELLA COM S A S CL 99 1 T $1.969.900,00 4 de 6 24,34% $328.316,66 $656.633,36
TX_LINE_RE = re.compile(
    r"^(\d{2}/\d{2}/\d{4})\s+"  # Date
    r"(.+)\s+"                  # Description (greedy, stops before type flag)
    r"([TA])\s+"                # Type: T=Titular, A=Adicional
    r"(-?\$?\s*[\d.,]+)\s*"     # Amount
    r"(.*)"                     # Rest of line (installments, rate, pending)
)


def _parse_colombian_number(s: str) -> float:
    """Parse Colombian-formatted number: 1.234.567,89 → 1234567.89

    Also handles negative values prefixed with '-'.
    """
    s = s.strip().replace("$", "").replace(" ", "").replace("%", "")
    if not s or s == "-":
        return 0.0
    negative = s.startswith("-")
    s = s.lstrip("-")
    val = float(s.replace(".", "").replace(",", "."))
    return -val if negative else val


def parse_falabella_credit_card(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement]:
    """Parse Falabella CMR credit card statement."""
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    card_last_four: str | None = None
    summary = StatementSummary()
    metadata = CreditCardMetadata()

    paga_antes_del_seen = False

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")

            for line in lines:
                # Normalize first — collapses doubled tokens from overlapping PDF layers
                stripped = _normalize_line(line).strip()

                # --- Metadata ---
                if not card_last_four:
                    m = CARD_NUMBER_RE.search(stripped)
                    if m:
                        card_last_four = m.group(1)

                if not period_to:
                    m = PERIOD_RE.match(stripped)
                    if m:
                        m1 = SPANISH_MONTHS.get(m.group(2).lower(), 0)
                        m2 = SPANISH_MONTHS.get(m.group(5).lower(), 0)
                        if m1 and m2:
                            period_from = date(int(m.group(3)), m1, int(m.group(1)))
                            period_to = date(int(m.group(6)), m2, int(m.group(4)))

                # payment_due_date: "Paga antes del" on one line, "20 FEB 2026" on the next
                if not metadata.payment_due_date:
                    if paga_antes_del_seen:
                        m = PAYMENT_DUE_DATE_LINE_RE.match(stripped)
                        if m:
                            month = SPANISH_MONTHS.get(m.group(2).lower(), 0)
                            if month:
                                metadata.payment_due_date = date(
                                    int(m.group(3)), month, int(m.group(1))
                                )
                        paga_antes_del_seen = False
                    elif PAGA_ANTES_DEL_RE.search(stripped):
                        paga_antes_del_seen = True

                # --- Summary / Credit limits ---
                if not metadata.credit_limit:
                    m = CUPO_TOTAL_RE.search(stripped)
                    if m:
                        metadata.credit_limit = _parse_colombian_number(m.group(1))

                if not metadata.available_credit:
                    m = AVAILABLE_RE.search(stripped)
                    if m:
                        metadata.available_credit = _parse_colombian_number(m.group(1))

                if not metadata.minimum_payment:
                    m = MIN_PAYMENT_RE.search(stripped)
                    if m:
                        metadata.minimum_payment = _parse_colombian_number(m.group(1))

                # "Has utilizado" = total credit used = total payment due
                if not metadata.total_payment_due:
                    m = USED_RE.search(stripped)
                    if m:
                        val = _parse_colombian_number(m.group(1))
                        metadata.total_payment_due = val
                        summary.final_balance = val

                # Explicit "pago total" field if present
                if not metadata.total_payment_due:
                    m = TOTAL_PAYMENT_RE.search(stripped)
                    if m:
                        val = _parse_colombian_number(m.group(1))
                        metadata.total_payment_due = val
                        summary.final_balance = val

                # Interest charged: "Intereses corrientes: 46.240,30"
                if not summary.interest_charged:
                    m = INTEREST_CHARGED_RE.search(stripped)
                    if m:
                        summary.interest_charged = _parse_colombian_number(m.group(1))

                # --- Transactions ---
                m = TX_LINE_RE.match(stripped)
                if m:
                    date_str = m.group(1)
                    desc = m.group(2).strip()
                    amount_str = m.group(4)
                    rest_str = m.group(5).strip()

                    try:
                        pts = date_str.split("/")
                        tx_date = date(int(pts[2]), int(pts[1]), int(pts[0]))

                        amount = _parse_colombian_number(amount_str)

                        direction = TransactionDirection.OUTFLOW
                        if amount < 0:
                            direction = TransactionDirection.INFLOW
                            amount = abs(amount)
                        elif desc.upper().startswith("DEVOLUCION") or desc.upper().startswith("PAGO"):
                            direction = TransactionDirection.INFLOW

                        # Parse installments: "4 de 6" in rest
                        installments = None
                        inst_match = re.match(r"(\d+\s+de\s+\d+)", rest_str)
                        if inst_match:
                            installments = inst_match.group(1)

                        transactions.append(
                            ParsedTransaction(
                                date=tx_date,
                                description=desc,
                                amount=amount,
                                direction=direction,
                                installments=installments,
                                currency="COP",
                            )
                        )
                    except ValueError:
                        continue

    return [
        ParsedStatement(
            bank="falabella",
            statement_type=StatementType.CREDIT_CARD,
            card_last_four=card_last_four,
            period_from=period_from,
            period_to=period_to,
            currency="COP",
            summary=summary,
            credit_card_metadata=metadata,
            transactions=transactions,
        )
    ]
