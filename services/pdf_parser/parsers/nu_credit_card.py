"""NU Colombia Tarjeta de Crédito (credit card) PDF parser.

Parses NU Colombia credit card statements.
Number format: Colombian style (period = thousands, comma = decimal) e.g. $3.950.000,00
Date format: Multi-line layout with DD MMM on one line, YYYY on next
Interest rates shown as monthly (M.V.)
"""

from __future__ import annotations

import logging
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
from parsers.utils import SPANISH_MONTHS, parse_co_number

logger = logging.getLogger("pdf_parser.nu_credit_card")

# --- Regex patterns ---
MONTH_TOKEN = r"(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)"

# Card last four: "• • • • 7437" or "• • • • 2867"
CARD_LAST_FOUR_RE = re.compile(
    r"(?:•\s*){1,4}(\d{4})|(?:\+|\*)?\.{3,}\s*(\d{4})", re.IGNORECASE
)

# Period: "Periodo facturado\n12 ENE - 08 FEB 2026" or on same line
PERIOD_RE = re.compile(
    r"Periodo\s+facturado\s*\n?\s*"
    rf"(\d{{1,2}})\s*{MONTH_TOKEN}\s*-\s*"
    rf"(\d{{1,2}})\s*{MONTH_TOKEN}\s+"
    r"(\d{4})",
    re.IGNORECASE,
)

# Payment due date: on its own line "02 MAR 2026"
# Pattern: "Fecha límite de pago" line, then the date on the next line
PAYMENT_DUE_DATE_RE = re.compile(
    rf"(\d{{1,2}})\s*{MONTH_TOKEN}[a-z]*\s+"
    r"(\d{4})",
    re.IGNORECASE,
)

# Credit limit: "Tu cupo definido" then $ value on next line
CREDIT_LIMIT_RE = re.compile(r"\$\s*([\d.,]+)")

# Used credit: appears in the same section as "Usado"
USED_CREDIT_RE = re.compile(r"Usado\s*\n?\s*\$\s*([\d.,]+)", re.IGNORECASE)

# Available credit: "Disponible" then value
AVAILABLE_CREDIT_RE = re.compile(
    r"Disponible\s*\n?\s*\$\s*([\d.,]+)", re.IGNORECASE
)

# Total payment due: "PAGO HASTA EL [date] $[amount]"
TOTAL_PAYMENT_DUE_RE = re.compile(
    r"PAGO\s+HASTA\s+EL\s+\d+\s+\w+\s+\d+\s*\$\s*([\d.,]+)", re.IGNORECASE
)

# Minimum payment: "PAGO MÍNIMO $[amount]"
MINIMUM_PAYMENT_RE = re.compile(
    r"PAGO\s+M[ÍI]NIMO\s*\$\s*([\d.,]+)", re.IGNORECASE
)

# Interest charged: "Intereses + $[amount]" or "Intereses\n+ $[amount]"
INTEREST_CHARGED_RE = re.compile(r"Intereses\s*\+?\s*\$\s*([\d.,]+)", re.IGNORECASE)

# Transaction date pattern: "DD MMM" at start of line (allows OCR variants like 16FEB2025)
TX_DATE_RE = re.compile(rf"^(\d{{1,2}})\s*{MONTH_TOKEN}", re.IGNORECASE)

# Year pattern: "2026" (may be followed by description continuation)
# Note: used with search(), not match(), so we can't use ^ anchor
YEAR_RE = re.compile(r"(\d{4})\b")

# Amount pattern: Colombian-formatted number
AMOUNT_RE = re.compile(r"\$\s*([\d.,]+)")

# Installment pattern: "X de Y"
INSTALLMENT_RE = re.compile(r"(\d+)\s+de\s+(\d+)", re.IGNORECASE)


def _ocr_pdf_pages(pdf_path: str, password: str | None = None) -> list[str]:
    """OCR all pages and return one extracted text block per page."""
    from pdf2image import convert_from_path
    import pytesseract

    kwargs: dict = {"dpi": 200}
    if password:
        kwargs["userpw"] = password

    pages = convert_from_path(pdf_path, **kwargs)
    texts: list[str] = []
    for page in pages:
        text = pytesseract.image_to_string(page, lang="spa", config="--psm 4")
        texts.append(text or "")
    return texts


def _normalize_ocr_line(line: str) -> str:
    """Normalize common OCR artifacts from Nu table rows."""
    cleaned = line.strip()
    if not cleaned:
        return ""

    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"[«»]", "", cleaned)
    cleaned = cleaned.replace("  ", " ").strip()

    # "16FEB2025" -> "16 FEB 2025"
    cleaned = re.sub(
        rf"^(\d{{1,2}})\s*{MONTH_TOKEN}\s*(\d{{4}})\b",
        lambda m: f"{m.group(1)} {m.group(2).upper()} {m.group(3)}",
        cleaned,
        flags=re.IGNORECASE,
    )
    # "1de 6" -> "1 de 6"
    cleaned = re.sub(r"\b(\d+)\s*de\s*(\d+)\b", r"\1 de \2", cleaned, flags=re.IGNORECASE)
    return cleaned


def _build_transaction_text(lines: list[str]) -> str:
    """Reconstruct transaction table text by joining lines intelligently.

    Transaction table lines are split across multiple lines:
    - Date (DD MMM) on one line
    - Year (YYYY) on next line
    - Rest of row information on same line as date or following lines
    - Some descriptions span multiple lines (e.g., "Gracias por tu" + "pago")

    We reconstruct by joining consecutive date-continuation lines.
    """
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = _normalize_ocr_line(line)

        # If this line starts with a date pattern
        if TX_DATE_RE.match(stripped):
            transaction_parts = [stripped]
            i += 1

            # Look ahead for continuation (usually the year or description continuation)
            while i < len(lines):
                next_line = _normalize_ocr_line(lines[i])

                # If it's a year, extract it and continue looking for more
                if YEAR_RE.match(next_line):
                    transaction_parts.append(next_line)
                    i += 1
                    # Continue to capture anything after the year (like "pago")
                    # But set a limit to avoid capturing too much
                    max_continuation = 3
                    for _ in range(max_continuation):
                        if i >= len(lines):
                            break
                        next_next_line = _normalize_ocr_line(lines[i])
                        # Stop if we hit a date or empty line
                        if TX_DATE_RE.match(next_next_line) or not next_next_line:
                            break
                        # Stop if we hit "Pago mínimo" or other footer
                        if "pago" in next_next_line.lower() and "mínimo" in next_next_line.lower():
                            break
                        # If it's a detail line, include it
                        if next_next_line.startswith("↪"):
                            transaction_parts.append(next_next_line)
                            i += 1
                        # Otherwise check if it's a continuation line
                        # (year might be followed by word(s) then detail rows)
                        elif next_next_line and not next_next_line[0].isdigit():
                            # Check if this looks like a table continuation
                            # Accept if it has few words and few $
                            word_count = len(next_next_line.split())
                            dollar_count = next_next_line.count("$")
                            if word_count <= 5 and dollar_count <= 2:
                                transaction_parts.append(next_next_line)
                                i += 1
                            else:
                                break
                        else:
                            break
                    break  # Done with this transaction
                # If it looks like a detail line (starts with ↪), it's a continuation
                elif next_line.startswith("↪"):
                    transaction_parts.append(next_line)
                    i += 1
                # If it's another date, break
                elif TX_DATE_RE.match(next_line):
                    break
                # If it's empty, skip but don't break
                elif not next_line:
                    i += 1
                else:
                    # Some other text - only include if it looks like a description continuation
                    # (short line, no date pattern)
                    if len(next_line.split()) <= 3 and next_line.count("$") == 0:
                        transaction_parts.append(next_line)
                        i += 1
                    else:
                        break

            # Join the transaction parts
            combined = " ".join(transaction_parts)
            result.append(combined)
        else:
            i += 1

    return "\n".join(result)


def _parse_transactions(text: str, to_date: date) -> list[ParsedTransaction]:
    """Parse transaction lines from the combined transaction text.

    Each transaction line looks like:
    "08 FEB 2026 Amazon Prime $24.900,00 1 de 1 $24.900,00 1.87% $0,00 $24.900,00 $0,00"

    Or for payments:
    "30 ENE 2026 Gracias por tu pago $1.288.978,02 $0,00 -$1.778,55"

    Extract:
    - date (DD MMM YYYY)
    - description (text between date and first $)
    - amount (first $ value)
    - installments (if present: "X de Y")
    - direction (INFLOW if payment, OUTFLOW otherwise)
    """
    transactions: list[ParsedTransaction] = []

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Try to match date at start
        date_match = TX_DATE_RE.search(line)
        if not date_match:
            continue

        # Extract date and year
        day = int(date_match.group(1))
        month_str = date_match.group(2).lower()
        month = SPANISH_MONTHS.get(month_str, 0)
        if not month:
            continue

        # Look for year in the line (after the month)
        rest_after_date = line[date_match.end():].strip()
        year_match = YEAR_RE.search(rest_after_date)
        if year_match:
            year = int(year_match.group(1))
            # Text before year is in desc_part, text after year might continue description
            desc_before_year = rest_after_date[:year_match.start()].strip()
            desc_after_year = rest_after_date[year_match.end():].strip()
            desc_part = desc_before_year
        else:
            # No year found, assume current to_date year
            year = to_date.year
            desc_part = rest_after_date
            desc_after_year = ""

        # Resolve year for month boundaries
        if month > to_date.month:
            year = to_date.year - 1
        elif year < to_date.year - 1 or year > to_date.year + 1:
            year = to_date.year

        try:
            tx_date = date(year, month, day)
        except ValueError:
            continue

        # Extract description and amount
        # Description is everything before the first $
        dollar_pos = desc_part.find("$")
        if dollar_pos < 0:
            continue

        description = desc_part[:dollar_pos].strip()
        if not description:
            continue

        # If there's text after the year, it might be part of the description
        # (e.g., "pago" after "2026" in "Gracias por tu ... 2026 pago ↪ ...")
        if desc_after_year:
            # Take words before ↪ or before a large number of $
            after_year_words = desc_after_year.split()
            words_to_add = []
            for word in after_year_words:
                if word.startswith("↪"):
                    break
                if word.startswith("$"):
                    break
                words_to_add.append(word)
            if words_to_add:
                description = (description + " " + " ".join(words_to_add)).strip()

        # Clean up description: remove continuation lines (detail rows with ↪)
        # Also remove common table continuation suffixes
        description_parts = description.split("↪")
        description = description_parts[0].strip()

        # Remove common suffixes that are continuation of table
        # (like product names split across lines)
        for suffix in ["Pago*Mercadoli", "Sura", "Compania de C", "Fruttiwa", "Bancolombia P"]:
            if description.endswith(suffix):
                description = description[:-len(suffix)].strip()

        is_payment = "gracias por tu pago" in description.lower() or "gracias por tu" in description.lower()

        # Get the amount (first $ value after description)
        amounts_part = desc_part[dollar_pos:]
        amount_matches = AMOUNT_RE.findall(amounts_part)

        if not amount_matches:
            continue

        try:
            amount = parse_co_number(amount_matches[0])
        except ValueError:
            continue

        if amount <= 0:
            continue

        # Look for installments (e.g. "1 de 24")
        installment_current = None
        installment_total = None
        inst_match = INSTALLMENT_RE.search(desc_part)
        if inst_match:
            installment_current = int(inst_match.group(1))
            installment_total = int(inst_match.group(2))

        # Determine direction
        direction = (
            TransactionDirection.INFLOW if is_payment else TransactionDirection.OUTFLOW
        )

        transactions.append(
            ParsedTransaction(
                date=tx_date,
                description=description,
                amount=amount,
                direction=direction,
                currency="COP",
                installment_current=installment_current,
                installment_total=installment_total,
            )
        )

    return transactions


def parse_nu_credit_card(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement]:
    """Parse a NU Colombia credit card PDF.

    Returns a list with a single ParsedStatement (NU is COP-only).
    """
    # Extract text from all pages using pdfplumber first.
    # Fallback to OCR for image-based statements (e.g., CamScanner).
    page_texts: list[str] = []
    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            page_texts.append(text)

    combined_text = "\n".join(page_texts)
    if len(combined_text.strip()) < 40:
        logger.info(
            "Nu parser: low text extraction (%s chars), using OCR fallback",
            len(combined_text.strip()),
        )
        try:
            page_texts = _ocr_pdf_pages(pdf_path, password=password)
            combined_text = "\n".join(page_texts)
            logger.info("Nu parser: OCR extraction chars=%s", len(combined_text.strip()))
        except Exception:
            logger.exception("Nu parser: OCR fallback failed")

    combined_upper = combined_text.upper()

    # --- Extract metadata from first page summary ---
    card_last_four: str | None = None
    period_from: date | None = None
    period_to: date | None = None
    credit_limit: float | None = None
    available_credit: float | None = None
    total_payment_due: float | None = None
    minimum_payment: float | None = None
    payment_due_date: date | None = None
    interest_charged: float | None = None

    # Card last four (physical card preferred, fallback to virtual)
    card_matches = list(CARD_LAST_FOUR_RE.finditer(combined_text))
    if card_matches:
        first = card_matches[0]
        card_last_four = first.group(1) or first.group(2)

    # Period: look for "Periodo facturado: 12 ENE - 08 FEB 2026"
    period_match = PERIOD_RE.search(combined_upper)
    if period_match:
        try:
            from_day = int(period_match.group(1))
            from_month = SPANISH_MONTHS.get(period_match.group(2).lower(), 0)
            to_day = int(period_match.group(3))
            to_month = SPANISH_MONTHS.get(period_match.group(4).lower(), 0)
            year = int(period_match.group(5))

            if from_month and to_month:
                from_year = year if from_month <= to_month else year - 1
                period_from = date(from_year, from_month, from_day)
                period_to = date(year, to_month, to_day)
        except (ValueError, IndexError):
            pass

    # Credit limit: look for "Tu cupo definido" line, skip to next line break, then get $ value
    cupo_idx = combined_upper.find("TU CUPO DEFINIDO")
    if cupo_idx >= 0:
        # Find the text after "Tu cupo definido"
        text_after = combined_text[cupo_idx:]
        lines = text_after.split("\n")
        # Skip the first line ("Tu cupo definido") and look for $ in next few lines
        for i in range(1, min(5, len(lines))):
            line = lines[i].strip()
            # Look for a line that's just a $ value (or mostly a $ value)
            if line.startswith("$"):
                m = CREDIT_LIMIT_RE.match(line)
                if m:
                    try:
                        credit_limit = parse_co_number(m.group(1))
                        break
                    except ValueError:
                        pass

    # Available credit: when "Usado" and "Disponible" are on the same line,
    # their values are on the next line. Need to get the SECOND $ value.
    available_idx = combined_upper.find("DISPONIBLE")
    if available_idx >= 0:
        # Look in next 100 chars for the values
        search_text = combined_text[available_idx:available_idx + 100]
        values = AMOUNT_RE.findall(search_text)
        # If there are multiple values (e.g., "Usado $X Disponible $Y"),
        # take the last one (or second if exactly 2)
        if len(values) >= 2:
            try:
                available_credit = parse_co_number(values[1])
            except ValueError:
                pass
        elif len(values) == 1:
            try:
                available_credit = parse_co_number(values[0])
            except ValueError:
                pass

    # Total payment due
    m = TOTAL_PAYMENT_DUE_RE.search(combined_upper)
    if m:
        try:
            total_payment_due = parse_co_number(m.group(1))
        except ValueError:
            pass

    # Minimum payment
    m = MINIMUM_PAYMENT_RE.search(combined_upper)
    if m:
        try:
            minimum_payment = parse_co_number(m.group(1))
        except ValueError:
            pass

    # Payment due date: look for "Fecha límite de pago" followed by date
    fecha_idx = combined_upper.find("FECHA LÍMITE DE PAGO")
    if fecha_idx < 0:
        fecha_idx = combined_upper.find("FECHA LIMITE DE PAGO")

    if fecha_idx >= 0:
        # Look in next 100 chars for the date
        search_text = combined_text[fecha_idx:fecha_idx + 100]
        m = PAYMENT_DUE_DATE_RE.search(search_text)
        if m:
            try:
                day = int(m.group(1))
                month = SPANISH_MONTHS.get(m.group(2).lower(), 0)
                year = int(m.group(3))
                if month:
                    payment_due_date = date(year, month, day)
            except (ValueError, IndexError):
                pass

    # If period not found, infer a reasonable range from payment due date.
    # Nu periods are typically monthly, so default to previous-month span.
    if not period_from and payment_due_date:
        period_to = payment_due_date
        inferred_month = payment_due_date.month - 1 or 12
        inferred_year = (
            payment_due_date.year
            if payment_due_date.month > 1
            else payment_due_date.year - 1
        )
        period_from = date(inferred_year, inferred_month, min(payment_due_date.day, 28))
    if not period_to:
        period_to = date.today()
    if not period_from:
        period_from = date(period_to.year, period_to.month, 1)

    # Interest charged
    m = INTEREST_CHARGED_RE.search(combined_text)
    if m:
        try:
            interest_charged = parse_co_number(m.group(1))
        except ValueError:
            pass

    # Extract Nu's monthly rate from transaction rows (M.V.) and convert to E.A.
    # Example: 1.89% M.V. -> ((1 + 0.0189)^12 - 1) * 100 = 25.19% E.A.
    interest_rate: float | None = None
    monthly_rate_mv: float | None = None
    rate_pattern = re.compile(r"(\d+\.?\d*)\s*%")
    rate_matches = rate_pattern.findall(combined_text)
    if rate_matches:
        for rate_str in rate_matches:
            try:
                rate_val = float(rate_str)
                if 0.5 <= rate_val <= 5.0:
                    monthly_rate_mv = rate_val
                    interest_rate = round((((1 + (rate_val / 100)) ** 12) - 1) * 100, 2)
                    break
            except ValueError:
                pass
    if monthly_rate_mv is not None:
        logger.info(
            "Nu parser: converted interest rate from %.4f%% M.V. to %.4f%% E.A.",
            monthly_rate_mv,
            interest_rate,
        )

    # --- Parse transactions from table ---
    # The transaction table starts after page 1 data
    transaction_section = ""
    if len(page_texts) > 1:
        transaction_section = page_texts[1]

    # Split into lines for intelligent reconstruction
    lines = transaction_section.split("\n")
    reconstructed = _build_transaction_text(lines)
    transactions = _parse_transactions(reconstructed, period_to)

    # Calculate purchases_and_charges: sum of OUTFLOW transactions
    purchases_and_charges = sum(
        tx.amount
        for tx in transactions
        if tx.direction == TransactionDirection.OUTFLOW
    )
    if purchases_and_charges <= 0:
        purchases_and_charges = None

    # Build statement
    cc_metadata = CreditCardMetadata(
        credit_limit=credit_limit,
        available_credit=available_credit,
        total_payment_due=total_payment_due,
        minimum_payment=minimum_payment,
        payment_due_date=payment_due_date,
        interest_rate=interest_rate,
    )

    summary = StatementSummary(
        final_balance=total_payment_due,
        interest_charged=interest_charged,
        purchases_and_charges=purchases_and_charges if purchases_and_charges and purchases_and_charges > 0 else None,
    )

    return [
        ParsedStatement(
            bank="nu",
            statement_type=StatementType.CREDIT_CARD,
            card_last_four=card_last_four,
            period_from=period_from,
            period_to=period_to,
            currency="COP",
            summary=summary,
            credit_card_metadata=cc_metadata,
            transactions=transactions,
        )
    ]
