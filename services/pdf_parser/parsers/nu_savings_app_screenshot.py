"""Nu (Cuenta Nu) savings app screenshot parser.

Expected OCR format (each transaction spans 2+ lines):

    [icon] Description text...    -$XX.XXX,XX or +$XX.XXX,XX
    [continuation lines...]
    DD mes - HH:MM [+ ...] or DD mes - HH:...

Number format: Colombian (dot = thousands, comma = decimals)
Direction: -$ = OUTFLOW, +$ = INFLOW

OCR quirks handled:
- Icons OCR'd as single chars ("E", "3", "a") at line starts
- "•" OCR'd as "+" in date lines: "20 oct - 15:51 + B..."
- Description may span multiple lines before the date line
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

logger = logging.getLogger("pdf_parser.nu_savings_app")

# Line with description and amount: "Enviaste a -$23.000,00"
# Amount is at the end with +/- sign
DESC_AMOUNT_RE = re.compile(
    r"^(.+?)\s+([+-])\s*\$\s*([\d.,]+)$",
)

# Date line: "20 oct - 15:51" or "12 may - 09:..." or "07 oct - 18:55 + ..."
# OCR renders "•" as "+" and may truncate with "..."
DATE_LINE_RE = re.compile(
    r"^(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b",
    re.IGNORECASE,
)

# UI noise
SKIP_PATTERNS = [
    "movimientos", "buscar movimiento", "buscar",
]


def parse_nu_savings_app(
    ocr_text: str,
    screenshot_date: date | None = None,
) -> ParsedStatement:
    """Parse Nu savings app OCR text into a ParsedStatement.

    Each transaction consists of:
    1. A line with description + signed amount (may have icon artifact prefix)
    2. Optional continuation lines (name wrapping)
    3. A date line (DD mes - HH:MM)
    """
    lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
    ref_date = screenshot_date or date.today()

    transactions: list[ParsedTransaction] = []
    # Pending transaction data (waiting for date line)
    pending_desc: str | None = None
    pending_amount: float | None = None
    pending_direction: TransactionDirection | None = None

    for line in lines:
        lower = line.lower()

        # Skip UI noise
        if any(p in lower for p in SKIP_PATTERNS):
            continue

        # Check for description + amount line
        cleaned = strip_icon_artifacts(line)
        desc_match = DESC_AMOUNT_RE.match(cleaned)
        if desc_match:
            # If we had a pending transaction without a date, emit with fallback date
            if pending_desc is not None and pending_amount is not None:
                transactions.append(ParsedTransaction(
                    date=ref_date,
                    description=pending_desc,
                    amount=pending_amount,
                    direction=pending_direction or TransactionDirection.OUTFLOW,
                    currency="COP",
                ))

            pending_desc = desc_match.group(1).strip()
            sign = desc_match.group(2)
            try:
                pending_amount = parse_colombian_number(desc_match.group(3))
            except ValueError:
                logger.warning("Could not parse Nu amount: %s", line)
                pending_desc = None
                pending_amount = None
                continue

            pending_direction = (
                TransactionDirection.OUTFLOW if sign == "-"
                else TransactionDirection.INFLOW
            )
            continue

        # Check for date line (completes a pending transaction)
        date_match = DATE_LINE_RE.match(line)
        if date_match and pending_desc is not None:
            day = int(date_match.group(1))
            month = MONTH_MAP.get(date_match.group(2).lower(), 1)
            # Infer year
            year = ref_date.year
            if month > ref_date.month:
                year -= 1
            try:
                tx_date = date(year, month, day)
            except ValueError:
                tx_date = ref_date

            transactions.append(ParsedTransaction(
                date=tx_date,
                description=pending_desc,
                amount=pending_amount or 0,
                direction=pending_direction or TransactionDirection.OUTFLOW,
                currency="COP",
            ))
            pending_desc = None
            pending_amount = None
            pending_direction = None
            continue

    # Emit last pending transaction if any
    if pending_desc is not None and pending_amount is not None:
        transactions.append(ParsedTransaction(
            date=ref_date,
            description=pending_desc,
            amount=pending_amount,
            direction=pending_direction or TransactionDirection.OUTFLOW,
            currency="COP",
        ))

    logger.info("Nu savings app parsed: transactions=%s", len(transactions))

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en la captura de pantalla de Nu."
        )

    dates = [t.date for t in transactions]
    return ParsedStatement(
        bank="nu",
        statement_type=StatementType.SAVINGS,
        period_from=min(dates),
        period_to=max(dates),
        currency="COP",
        transactions=transactions,
    )
