"""Bancolombia mobile app screenshot parser.

Parses screenshots from the Bancolombia app's transaction list view.
Expected OCR format (repeating):

    DD MMM YYYY
    DESCRIPTION
    COP -$ XX.XXX,XX

Number format: Colombian (dot = thousands, comma = decimals) e.g. 30.000,00
Direction: negative amounts (-$) are OUTFLOW, positive (+$ or bare $) are INFLOW.

OCR quirks handled:
- "cor" instead of "COP" (common OCR misread)
- Space instead of comma in decimals: "43.627 81" → 43627.81
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
from parsers.image_utils import MONTH_MAP, parse_colombian_number

logger = logging.getLogger("pdf_parser.bancolombia_app")

# Date line: "06 ABR 2026" or "6 ABR 2026"
DATE_RE = re.compile(
    r"^(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(\d{4})$",
    re.IGNORECASE,
)

# Amount line: "COP -$ 30.000,00" — OCR may produce "cor" instead of "cop",
# and space instead of comma for decimals
AMOUNT_RE = re.compile(
    r"^co[pr]\s*([+-])?\s*\$\s*([\d., ]+)$",
    re.IGNORECASE,
)

# UI noise to skip when collecting description lines
SKIP_PATTERNS = [
    "cuenta de ahorro", "detalles", "movimientos", "transferir plata",
    "ir a día", "ira día", "más", "bancolombia",
]


def parse_bancolombia_app(
    ocr_text: str,
    screenshot_date: date | None = None,
) -> ParsedStatement:
    """Parse Bancolombia app OCR text into a ParsedStatement."""
    lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]

    transactions: list[ParsedTransaction] = []
    current_date: date | None = None
    description_lines: list[str] = []

    for line in lines:
        date_match = DATE_RE.match(line)
        if date_match:
            day = int(date_match.group(1))
            month = MONTH_MAP[date_match.group(2).lower()]
            year = int(date_match.group(3))
            current_date = date(year, month, day)
            description_lines = []
            continue

        amount_match = AMOUNT_RE.match(line)
        if amount_match and current_date is not None:
            sign = amount_match.group(1) or "+"
            raw = amount_match.group(2).strip()
            try:
                amount = parse_colombian_number(raw)
            except ValueError:
                logger.warning("Could not parse Bancolombia amount: %s", line)
                continue

            direction = (
                TransactionDirection.OUTFLOW if sign == "-"
                else TransactionDirection.INFLOW
            )
            description = " ".join(description_lines).strip() or "Sin descripción"

            transactions.append(ParsedTransaction(
                date=current_date,
                description=description,
                amount=amount,
                direction=direction,
                currency="COP",
            ))
            current_date = None
            description_lines = []
            continue

        if current_date is not None:
            lower = line.lower()
            if not any(p in lower for p in SKIP_PATTERNS):
                description_lines.append(line)

    logger.info("Bancolombia app parsed: transactions=%s", len(transactions))

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en la captura de pantalla de Bancolombia."
        )

    dates = [t.date for t in transactions]
    return ParsedStatement(
        bank="bancolombia",
        statement_type=StatementType.SAVINGS,
        period_from=min(dates),
        period_to=max(dates),
        currency="COP",
        transactions=transactions,
    )
