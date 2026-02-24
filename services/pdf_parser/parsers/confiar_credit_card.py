"""Cooperativa Confiar Credit Card PDF parser.

Parses Cooperativa Confiar credit card statements (tarjeta crédito).
These PDFs are image-based (produced by CamScanner), so OCR via pytesseract
is required to extract text.

Number format: OCR outputs US-style commas as thousands separators (5,151,934)
  and dots for decimals (24.02). _parse_num() handles both automatically.
Date format in header: DD-MM-YYYY
Date format in table:  DD/MM/YYYY

Transaction table columns:
  Fecha | Comprobante | Descripción | ValorOriginal | EA | Corriente | Cargos | Abonos | Pendiente | Plazo | Pendientes

Direction logic:
  - Abonos > 0 and Cargos == 0  →  INFLOW  (payment / credit)
  - Cargos > 0                  →  OUTFLOW (purchase / fee)

Layout note: the statement uses a two-column layout. OCR reads across both
columns simultaneously, so credit-limit labels ("Cupo disponible Cupo total")
appear on one line and their values on the NEXT line. Metadata extraction
uses a state machine to handle this.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

from pdf2image import convert_from_path
import pytesseract

from models import (
    CreditCardMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

logger = logging.getLogger("pdf_parser.confiar")


# ---------------------------------------------------------------------------
# OCR helpers
# ---------------------------------------------------------------------------

def _ocr_pages(pdf_path: str, password: str | None = None) -> list[str]:
    """Rasterise each page and return OCR text per page."""
    kwargs: dict = {"dpi": 300}
    if password:
        kwargs["userpw"] = password
    logger.info("Confiar OCR start: pdf=%s dpi=%s", pdf_path, kwargs["dpi"])
    try:
        pages = convert_from_path(pdf_path, **kwargs)
    except Exception as exc:
        logger.exception("Failed converting PDF to images (poppler/pdftoppm)")
        raise RuntimeError(
            "No se pudo convertir el PDF a imágenes para OCR. "
            "Verifica que poppler-utils (pdftoppm) esté instalado en el contenedor."
        ) from exc

    logger.info("Confiar OCR pages rasterized: pages=%s", len(pages))
    page_texts: list[str] = []
    try:
        for index, page_img in enumerate(pages, start=1):
            text = pytesseract.image_to_string(page_img, lang="spa", config="--psm 4")
            page_texts.append(text)
            logger.info("Confiar OCR page done: page=%s chars=%s", index, len(text))
    except Exception as exc:
        logger.exception("Failed running tesseract OCR")
        raise RuntimeError(
            "No se pudo ejecutar OCR con Tesseract. "
            "Verifica que tesseract-ocr y tesseract-ocr-spa estén instalados en el contenedor."
        ) from exc

    return page_texts


def _clean_line(line: str) -> str:
    """Strip table-border and OCR artefacts from a line."""
    return re.sub(r"\s*\|\s*", " ", line).strip()


# ---------------------------------------------------------------------------
# Number / date helpers
# ---------------------------------------------------------------------------

def _parse_num(s: str) -> float:
    """Parse a number token from OCR output.

    The OCR produces US-style thousands (1,234,567) for large amounts and
    dots for decimals (24.02). Also handles Colombian format (1.234.567,89)
    and plain integers. Detects format by separator position/count.
    """
    s = s.strip().replace("$", "").replace("%", "").replace(" ", "")
    if not s or s in (".", ",", "-"):
        return 0.0
    # OCR artefact: ".00" / "00" in the rate columns when zero
    if re.fullmatch(r"\.?\d{1,2}", s):
        return float(s.lstrip(".") or "0")

    has_comma = "," in s
    has_dot   = "." in s

    if has_comma and not has_dot:
        digits_after = len(s) - s.rfind(",") - 1
        if s.count(",") > 1 or digits_after != 2:
            return float(s.replace(",", ""))   # US thousands: 5,151,934
        else:
            return float(s.replace(",", "."))  # Colombian decimal: 1,81

    elif has_dot and not has_comma:
        digits_after = len(s) - s.rfind(".") - 1
        if s.count(".") > 1 or digits_after > 2:
            return float(s.replace(".", ""))   # Colombian thousands: 7.554.272
        else:
            return float(s)                    # Plain decimal: 24.02

    elif has_comma and has_dot:
        if s.rfind(",") > s.rfind("."):
            return float(s.replace(".", "").replace(",", "."))  # Colombian
        else:
            return float(s.replace(",", ""))                    # US

    return float(s)


def _parse_date_str(s: str) -> date | None:
    """Parse DD-MM-YYYY or DD/MM/YYYY."""
    for fmt in ("%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Card number: "550237******2266" → last 4
CARD_RE = re.compile(r"5\d{5}[\*\s]+(\d{4})")

# Header dates: "15-12-2025"
DATE_RE = re.compile(r"\b(\d{2}-\d{2}-\d{4})\b")

# Transaction start: DD/MM/YYYY <comprobante> <rest>
TX_START_RE = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(.+)$")

NUM_TOKEN_RE = re.compile(r"^[\d.,]+$")

# Summary section — label and value on the SAME line
CARGOS_MES_RE     = re.compile(r"Cargos\s+del\s+mes\s+([\d.,]+)", re.IGNORECASE)
AHORROS_RE        = re.compile(r"Ahorros\s+o\s+Cr[eé]ditos\s+([\d.,]+)", re.IGNORECASE)
INTERES_CO_RE     = re.compile(r"Inter[eé]s\s+corriente\s+([\d.,]+)", re.IGNORECASE)
INTERES_MO_RE     = re.compile(r"Inter[eé]s\s+de\s+mora\s+([\d.,]+)", re.IGNORECASE)
PAGO_TOTAL_EQ_RE  = re.compile(r"=\)?\s*Pago\s+total\s+([\d.,]+)", re.IGNORECASE)

# Labels whose values appear on the NEXT line (two-column layout)
CUPO_DISP_TOTAL_RE = re.compile(r"Cupo\s+disponible\s+Cupo\s+total", re.IGNORECASE)
PAGO_MIN_TOT_RE    = re.compile(r"Pago\s+m[ií]nimo\s+Pago\s+total", re.IGNORECASE)

# Footer marker — stop collecting tx continuation lines after this
FOOTER_MARKER_RE = re.compile(
    r"REFERENCIA\s+DE\s+PAGO|Gente\s+de\s+Confiar|CamScanner",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Transaction parsing
# ---------------------------------------------------------------------------

def _reconstruct_tx_lines(lines: list[str]) -> list[str]:
    """Merge OCR description-overflow lines into single transaction lines.

    Stops collecting at footer markers to prevent footer text from
    contaminating the last transaction's line.
    """
    result: list[str] = []
    current: str | None = None

    for raw in lines:
        line = _clean_line(raw)
        if not line:
            continue

        # Footer reached — flush and stop
        if FOOTER_MARKER_RE.search(line):
            if current is not None:
                result.append(current)
                current = None
            break

        if TX_START_RE.match(line):
            if current is not None:
                result.append(current)
            current = line
        elif current is not None:
            # Append only pure-alpha short lines (description overflow)
            if not re.fullmatch(r"[\d.,\s]+", line) and len(line) < 40:
                current = current + " " + line
            else:
                result.append(current)
                current = None

    if current is not None:
        result.append(current)

    return result


def _split_tx_rest(rest: str) -> tuple[str, list[str]] | None:
    """Split a transaction's rest string into (description, numeric_tokens).

    The table layout is always: description ... valor_original EA corriente
    cargos abonos pendiente plazo pendientes.  OCR may drop trailing fields
    (plazo/pendientes) but the description and the first numeric tokens are
    reliably placed from the left.  We collect all contiguous numeric tokens
    starting at the first numeric token; anything after them (alpha overflow
    like "INTERNET" or "NACI") is discarded.
    """
    tokens = rest.split()
    desc_tokens: list[str] = []
    num_tokens:  list[str] = []
    in_nums = False

    for tok in tokens:
        if not in_nums:
            if NUM_TOKEN_RE.match(tok):
                in_nums = True
                num_tokens.append(tok)
            else:
                desc_tokens.append(tok)
        else:
            if NUM_TOKEN_RE.match(tok):
                num_tokens.append(tok)
            else:
                break  # alpha after numbers → stop (description overflow / noise)

    if len(num_tokens) < 5:  # need at least: valor, EA, corriente, cargos, abonos
        return None

    description = " ".join(desc_tokens).rstrip(".,| ").strip()
    return description, num_tokens


def _parse_transaction(line: str) -> tuple[ParsedTransaction, float | None] | None:
    """Parse a single reconstructed transaction line.

    Returns (ParsedTransaction, annual_rate) or None if parsing fails.
    """
    m = TX_START_RE.match(line)
    if not m:
        return None

    date_str    = m.group(1)
    comprobante = m.group(2)
    rest        = m.group(3).strip()

    tx_date = _parse_date_str(date_str)
    if tx_date is None:
        return None

    parts = _split_tx_rest(rest)
    if parts is None:
        return None

    description, nums = parts
    # Positional mapping from left (matches table column order):
    # [0]=valor_original, [1]=EA, [2]=corriente, [3]=cargos, [4]=abonos,
    # [5]=pendiente, [6]=plazo, [7]=pendientes
    # Fields beyond index 5 may be absent when OCR drops trailing columns.
    def n(i: int) -> str:
        return nums[i] if i < len(nums) else "0"

    try:
        ea_rate    = _parse_num(n(1))  # Efectivo Anual — the annual interest rate
        cargos     = _parse_num(n(3))
        abonos     = _parse_num(n(4))
        pendiente  = _parse_num(n(5))
        plazo      = int(float(n(6))) if n(6) else 0
        pendientes = int(float(n(7))) if n(7) else 0
    except (ValueError, TypeError):
        return None

    if cargos == 0 and abonos == 0:
        return None  # no financial movement — skip

    if abonos > 0 and cargos == 0:
        direction = TransactionDirection.INFLOW
        amount    = abonos
    else:
        direction = TransactionDirection.OUTFLOW
        amount    = cargos

    installment_current: int | None = None
    installment_total:   int | None = None
    if plazo > 1:
        installment_total   = plazo
        installment_current = plazo - pendientes

    return (
        ParsedTransaction(
            date=tx_date,
            description=description,
            amount=amount,
            direction=direction,
            balance=pendiente if pendiente > 0 else None,
            currency="COP",
            authorization_number=comprobante,
            installment_current=installment_current,
            installment_total=installment_total,
        ),
        ea_rate if ea_rate > 0 else None,
    )


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_confiar_credit_card(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement]:
    """Parse a Cooperativa Confiar credit card statement via OCR."""

    page_texts = _ocr_pages(pdf_path, password)
    all_lines  = "\n".join(page_texts).splitlines()

    # ---- Card number --------------------------------------------------------
    card_last_four: str | None = None
    for line in all_lines:
        m = CARD_RE.search(line)
        if m:
            card_last_four = m.group(1)
            break

    # ---- Period dates -------------------------------------------------------
    period_to:        date | None = None
    payment_due_date: date | None = None
    corte_seen  = False
    limite_seen = False

    for line in all_lines:
        cl = _clean_line(line)
        if not corte_seen  and re.search(r"Fecha\s+de\s+corte",       cl, re.IGNORECASE):
            corte_seen  = True
        if not limite_seen and re.search(r"Fecha\s+l[ií]mite\s+de\s+pago", cl, re.IGNORECASE):
            limite_seen = True

        dates = DATE_RE.findall(cl)
        if corte_seen and not period_to and dates:
            period_to = _parse_date_str(dates[0])
        if limite_seen and not payment_due_date:
            if len(dates) >= 2:
                payment_due_date = _parse_date_str(dates[1])
            elif dates and period_to and dates[-1] != period_to.strftime("%d-%m-%Y"):
                payment_due_date = _parse_date_str(dates[-1])

    # ---- Metadata (state machine for multi-line label/value pairs) ----------
    credit_limit:     float | None = None
    available_credit: float | None = None
    minimum_payment:  float | None = None
    total_payment_due: float | None = None

    expect: str | None = None  # which values to read from the next numeric line

    for line in all_lines:
        cl = _clean_line(line)

        # Labels whose values are on the NEXT line
        if CUPO_DISP_TOTAL_RE.search(cl):
            expect = "cupo"
            continue
        if PAGO_MIN_TOT_RE.search(cl):
            expect = "pagos"
            continue

        if expect == "cupo":
            nums = re.findall(r"[\d,]+", cl)
            valid = [n for n in nums if len(n) >= 5]  # at least 5 chars → real amount
            if len(valid) >= 2:
                available_credit = _parse_num(valid[0])
                credit_limit     = _parse_num(valid[1])
            expect = None
            continue

        if expect == "pagos":
            nums = re.findall(r"[\d,]+", cl)
            valid = [n for n in nums if len(n) >= 5]
            if len(valid) >= 2:
                minimum_payment   = _parse_num(valid[0])
                if total_payment_due is None:
                    total_payment_due = _parse_num(valid[1])
            expect = None
            continue

        # "(=) Pago total" — explicit equality line
        if total_payment_due is None:
            m2 = PAGO_TOTAL_EQ_RE.search(cl)
            if m2:
                total_payment_due = _parse_num(m2.group(1))

    # ---- Statement summary --------------------------------------------------
    charges_this_period: float | None = None
    credits_this_period: float | None = None
    interest_charged:    float | None = None
    previous_balance:    float | None = None

    for line in all_lines:
        cl = _clean_line(line)

        if charges_this_period is None:
            m3 = CARGOS_MES_RE.search(cl)
            if m3:
                charges_this_period = _parse_num(m3.group(1))

        if credits_this_period is None:
            m3 = AHORROS_RE.search(cl)
            if m3:
                credits_this_period = _parse_num(m3.group(1))

        if m3 := INTERES_CO_RE.search(cl):
            interest_charged = _parse_num(m3.group(1))
        if m3 := INTERES_MO_RE.search(cl):
            mora = _parse_num(m3.group(1))
            interest_charged = (interest_charged or 0.0) + mora

    # Saldo anterior: first standalone large number after "RESUMEN SALDOS"
    resumen_idx = next(
        (i for i, l in enumerate(all_lines) if "RESUMEN SALDOS" in l.upper()), None
    )
    if resumen_idx is not None:
        for line in all_lines[resumen_idx : resumen_idx + 5]:
            cl = _clean_line(line)
            if re.search(r"[a-zA-Z]", cl):
                continue  # skip lines with text
            m3 = re.search(r"\b(\d[\d.,]{4,})\b", cl)
            if m3:
                try:
                    previous_balance = _parse_num(m3.group(1))
                    break
                except ValueError:
                    pass

    # ---- Transactions -------------------------------------------------------
    interest_rate: float | None = None
    transactions:  list[ParsedTransaction] = []

    for tx_line in _reconstruct_tx_lines(all_lines):
        result = _parse_transaction(tx_line)
        if result is None:
            continue
        tx, annual_rate = result
        transactions.append(tx)
        if interest_rate is None and annual_rate is not None:
            interest_rate = annual_rate

    logger.info(
        "Confiar parse summary: card_last_four=%s period_to=%s due_date=%s transactions=%s",
        card_last_four,
        period_to,
        payment_due_date,
        len(transactions),
    )

    # ---- Assemble -----------------------------------------------------------
    return [
        ParsedStatement(
            bank="cooperativa_confiar",
            statement_type=StatementType.CREDIT_CARD,
            card_last_four=card_last_four,
            period_to=period_to,
            currency="COP",
            summary=StatementSummary(
                previous_balance=previous_balance,
                total_debits=charges_this_period,
                total_credits=credits_this_period,
                interest_charged=interest_charged,
                final_balance=total_payment_due,
            ),
            credit_card_metadata=CreditCardMetadata(
                credit_limit=credit_limit,
                available_credit=available_credit,
                interest_rate=interest_rate,
                total_payment_due=total_payment_due,
                minimum_payment=minimum_payment,
                payment_due_date=payment_due_date,
            ),
            transactions=transactions,
        )
    ]
