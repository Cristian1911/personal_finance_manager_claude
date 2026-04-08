"""Nequi mobile app screenshot parser.

Expected OCR format:

    D De Mes De YYYY           ← grouped date header
    [icon] Description -$XX.XXX,XX   ← description + amount on same line
    Subtitle                   ← optional subtitle below

OCR quirks handled:
- App icons OCR'd as "Q", "0)", "O", etc. at start of lines
- Description and amount often on the same line
- Sometimes amount is on a separate line with just icon artifact + amount
"""

from __future__ import annotations

import logging
import re
from datetime import date

from models import (
    ParsedStatement,
    ParsedTransaction,
    StatementType,
    TransactionDirection,
)
from parsers.image_utils import MONTH_MAP, parse_colombian_number, strip_icon_artifacts

logger = logging.getLogger("pdf_parser.nequi_app")

# Date header: "9 De Marzo De 2026" or "9 de marzo de 2026"
DATE_HEADER_RE = re.compile(
    r"^(\d{1,2})\s+[Dd]e\s+(\w+)\s+[Dd]e\s+(\d{4})$",
)

# Amount pattern anywhere in a line: "-$20.000,00" or "$20.000,00" or "-$ 20.000,00"
# OCR sometimes reads "$" as "s", so we also match "s 20.000,00" at end of line
AMOUNT_INLINE_RE = re.compile(
    r"([+-])?\s*[\$s]\s*([\d.,]+)",
)

# UI noise to skip
SKIP_PATTERNS = [
    "movimientos", "busca", "hoy", "más movimientos", "mas movimientos",
    "nequi.com.co", "para ver más", "para ver mas", "inicio", "servicios",
]


def parse_nequi_app(
    ocr_text: str,
    screenshot_date: date | None = None,
) -> ParsedStatement:
    """Parse Nequi app OCR text into a ParsedStatement.

    Nequi groups transactions under date headers. Due to OCR quirks with
    app icons, we look for amount patterns ($) on each line and extract
    the description from the text before the amount.
    """
    lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]

    transactions: list[ParsedTransaction] = []
    current_date: date | None = None
    last_description: str | None = None

    for line in lines:
        lower = line.lower()

        # Skip UI noise
        if any(p in lower for p in SKIP_PATTERNS):
            continue

        # Date header
        date_match = DATE_HEADER_RE.match(line)
        if date_match:
            day = int(date_match.group(1))
            month_name = date_match.group(2).lower()
            year = int(date_match.group(3))
            month = MONTH_MAP.get(month_name)
            if month:
                current_date = date(year, month, day)
                last_description = None
            continue

        if current_date is None:
            continue

        # Look for amount pattern in the line
        amount_match = AMOUNT_INLINE_RE.search(line)
        if amount_match:
            sign = amount_match.group(1) or "+"
            try:
                amount = parse_colombian_number(amount_match.group(2))
            except ValueError:
                logger.warning("Could not parse Nequi amount: %s", line)
                continue

            direction = (
                TransactionDirection.OUTFLOW if sign == "-"
                else TransactionDirection.INFLOW
            )

            # Extract description from text before the amount
            before_amount = line[:amount_match.start()].strip()
            description = strip_icon_artifacts(before_amount)

            # If description is empty/short, use the previous non-amount line
            if len(description) < 3 and last_description:
                description = last_description

            if not description:
                description = "Sin descripción"

            transactions.append(ParsedTransaction(
                date=current_date,
                description=description,
                amount=amount,
                direction=direction,
                currency="COP",
            ))
            last_description = None
            continue

        # Non-amount, non-date line: potential description for next amount
        cleaned = strip_icon_artifacts(line)
        if cleaned and len(cleaned) > 2:
            last_description = cleaned

    logger.info("Nequi app parsed: transactions=%s", len(transactions))

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en la captura de pantalla de Nequi."
        )

    dates = [t.date for t in transactions]
    return ParsedStatement(
        bank="nequi",
        statement_type=StatementType.SAVINGS,
        period_from=min(dates),
        period_to=max(dates),
        currency="COP",
        transactions=transactions,
    )
