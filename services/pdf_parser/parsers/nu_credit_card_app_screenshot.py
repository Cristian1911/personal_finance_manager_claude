"""Nu credit card app screenshot parser.

Expected OCR format:

    Day label (Ayer / Domingo / Hoy)   ← relative date header
    [icon] Description...    $XX.XXX,XX  ← amount (no sign)
    HH:MM             a XX meses       ← time + optional installments

    ¡Gracias por tu pago!              ← payment line (INFLOW)
    Pagaste $X.XXX.XXX,XX

Number format: Colombian (dot = thousands, comma = decimals)
Direction: "Gracias por tu pago" / "Pagaste" = INFLOW, everything else = OUTFLOW.

OCR quirks handled:
- Icons OCR'd as "E", "a", "uy", "*=" at line starts
- "a24 meses" (no space between "a" and number)
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
from parsers.image_utils import (
    DAY_NAME_MAP,
    parse_colombian_number,
    resolve_relative_date,
    strip_icon_artifacts,
)

logger = logging.getLogger("pdf_parser.nu_cc_app")

# Description + amount: "Comisión por... $1.686,54"
DESC_AMOUNT_RE = re.compile(
    r"^(.+?)\s+\$\s*([\d.,]+)$",
)

# Payment amount: "Pagaste $3.816.555,03"
PAYMENT_RE = re.compile(
    r"^[Pp]agaste\s+\$\s*([\d.,]+)$",
)

# Installment: "a 24 meses" or "a24 meses" (OCR may drop space)
INSTALLMENT_RE = re.compile(
    r"\ba\s*(\d+)\s+meses?\b",
    re.IGNORECASE,
)

# Time line: "14:07" or "01:04"
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")

# Time + installment: "14:07 a 24 meses" or "14:07 a24 meses"
TIME_INSTALLMENT_RE = re.compile(
    r"^(\d{1,2}:\d{2})\s+a\s*(\d+)\s+meses?$",
    re.IGNORECASE,
)

# Relative day labels
RELATIVE_LABELS = {"hoy", "ayer"} | set(DAY_NAME_MAP.keys())

# UI noise
SKIP_PATTERNS = [
    "buscar", "nu colombia",
]


def _is_day_label(line: str) -> bool:
    """Check if a line is a relative day label (Ayer, Domingo, etc.)."""
    return line.lower().strip() in RELATIVE_LABELS


def parse_nu_credit_card_app(
    ocr_text: str,
    screenshot_date: date | None = None,
) -> ParsedStatement:
    """Parse Nu credit card app OCR text into a ParsedStatement.

    Uses screenshot_date (defaults to today) to resolve relative day labels.
    """
    ref_date = screenshot_date or date.today()
    lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]

    transactions: list[ParsedTransaction] = []
    current_date: date = ref_date
    i = 0

    while i < len(lines):
        line = lines[i]
        lower = line.lower()

        # Skip UI noise
        if any(p in lower for p in SKIP_PATTERNS):
            i += 1
            continue

        # Day label header
        cleaned_line = strip_icon_artifacts(line)
        if _is_day_label(cleaned_line):
            resolved = resolve_relative_date(cleaned_line, ref_date)
            if resolved:
                current_date = resolved
            i += 1
            continue

        # Payment line: "¡Gracias por tu pago!"
        if "gracias por tu pago" in lower:
            # Next line should be "Pagaste $X.XXX.XXX,XX"
            if i + 1 < len(lines):
                payment_match = PAYMENT_RE.match(strip_icon_artifacts(lines[i + 1]))
                if payment_match:
                    try:
                        amount = parse_colombian_number(payment_match.group(1))
                        transactions.append(ParsedTransaction(
                            date=current_date,
                            description="Pago tarjeta de crédito",
                            amount=amount,
                            direction=TransactionDirection.INFLOW,
                            currency="COP",
                        ))
                    except ValueError:
                        logger.warning("Could not parse payment: %s", lines[i + 1])
                    i += 2
                    continue
            i += 1
            continue

        # Regular transaction: "[icon] Description... $XX.XXX,XX"
        desc_match = DESC_AMOUNT_RE.match(cleaned_line)
        if desc_match:
            description = strip_icon_artifacts(desc_match.group(1).strip())
            try:
                amount = parse_colombian_number(desc_match.group(2))
            except ValueError:
                logger.warning("Could not parse Nu CC amount: %s", line)
                i += 1
                continue

            installment_total: int | None = None

            # Peek at next line for time + installments
            if i + 1 < len(lines):
                next_line = strip_icon_artifacts(lines[i + 1])
                ti_match = TIME_INSTALLMENT_RE.match(next_line)
                if ti_match:
                    installment_total = int(ti_match.group(2))
                    i += 1
                elif TIME_RE.match(next_line):
                    # Check if installment info is on a separate line after time
                    if i + 2 < len(lines):
                        inst_match = INSTALLMENT_RE.match(strip_icon_artifacts(lines[i + 2]))
                        if inst_match:
                            installment_total = int(inst_match.group(1))
                            i += 1
                    i += 1

            transactions.append(ParsedTransaction(
                date=current_date,
                description=description or "Sin descripción",
                amount=amount,
                direction=TransactionDirection.OUTFLOW,
                currency="COP",
                installment_total=installment_total,
                installment_current=1 if installment_total else None,
            ))

        i += 1

    logger.info("Nu CC app parsed: transactions=%s", len(transactions))

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en la captura de pantalla de Nu tarjeta de crédito."
        )

    dates = [t.date for t in transactions]
    return ParsedStatement(
        bank="nu",
        statement_type=StatementType.CREDIT_CARD,
        period_from=min(dates),
        period_to=max(dates),
        currency="COP",
        transactions=transactions,
    )
