"""Bancolombia desktop web transaction list screenshot parser.

Parses screenshots from the Bancolombia website's transaction list view.
Uses pytesseract image_to_data() to extract word bounding boxes, then reconstructs
transactions by grouping words into visual rows.

Each transaction row contains (left to right):
- Date: day (1-2 digits, optional—OCR may fail), month (3-letter abbreviation), year (4 digits)
- Description: transaction description text (variable length)
- Reference (optional): 8-12 digit authorization number, or counterparty text (appended to description)
- Amount: "-$" (separate or combined), then number with periods/commas

Direction: "-$" prefix → OUTFLOW; "$" or no prefix → INFLOW
Number format: Colombian (period = thousands, comma = decimals) e.g. 69.800,00

Row association: Uses visual y-coordinate clustering (bounding boxes) to group words
into rows, then processes each row left-to-right. This preserves duplicate descriptions
(e.g., two "COBRO TRANSF QR" rows on the same day are kept separate).
"""

from __future__ import annotations

import logging
import re
from datetime import date
from pathlib import Path

from models import (
    ParsedStatement,
    ParsedTransaction,
    StatementType,
    TransactionDirection,
)
from parsers.image_utils import (
    MONTH_MAP,
    ocr_image_with_boxes,
    parse_colombian_number,
    group_words_into_rows,
)

logger = logging.getLogger("pdf_parser.bancolombia_web")

# Day: single or double digit
DAY_RE = re.compile(r"^\d{1,2}$")

# Month: three-letter Spanish abbreviation
MONTH_RE = re.compile(
    r"^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)$",
    re.IGNORECASE,
)

# Year: 4 digits
YEAR_RE = re.compile(r"^\d{4}$")

# Amount word: may be just a number, or "-$", or "$", etc.
# Pure number: digits, periods, commas
PURE_NUMBER_RE = re.compile(r"^[\d.,\s]+$")

# Reference number: purely numeric, 8-12 digits
REFERENCE_RE = re.compile(r"^\d{8,12}$")

# UI noise to skip
SKIP_PATTERNS = [
    "movimientos", "cuenta", "bancolombia",
]


def _extract_date_from_row_start(row_words: list[dict], last_seen_day: int | None = None) -> tuple[date, int] | None:
    """Extract date from the start of a row: day, month, year.

    Handles cases where OCR fails to recognize the day number.
    If day is missing but month+year are present, infer the day from the last seen day
    (assuming the transaction happened on the most recent past day we've seen).

    Returns (date object, words_consumed) or None if no valid date found.
    """
    if len(row_words) < 2:
        return None

    # Try pattern 1: day, month, year (3 words)
    if len(row_words) >= 3:
        day_text = row_words[0]["text"].strip()
        month_text = row_words[1]["text"].strip()
        year_text = row_words[2]["text"].strip()

        if DAY_RE.match(day_text) and MONTH_RE.match(month_text) and YEAR_RE.match(year_text):
            try:
                day = int(day_text)
                month = MONTH_MAP[month_text.lower()]
                year = int(year_text)
                return (date(year, month, day), 3)
            except (ValueError, KeyError):
                pass

    # Try pattern 2: month, year only (2 words, day missing due to OCR)
    # This handles cases like Row 0: "jun 2026 COMPRA EN RAPPI..."
    if len(row_words) >= 2:
        month_text = row_words[0]["text"].strip()
        year_text = row_words[1]["text"].strip()

        if MONTH_RE.match(month_text) and YEAR_RE.match(year_text):
            try:
                month = MONTH_MAP[month_text.lower()]
                year = int(year_text)
                # Use the last_seen_day if available, otherwise default to 1
                day = last_seen_day if last_seen_day else 1
                return (date(year, month, day), 2)
            except (ValueError, KeyError):
                pass

    return None


def _find_amount_and_sign(row_words: list[dict]) -> tuple[int, bool] | None:
    """Find the last numeric word and check if preceded by a sign word.

    Returns (last_word_index, is_outflow) or None if no amount found.

    The amount is the last word that looks like a number (contains digits).
    If the word before it is "-$", "-", "$ -", etc., it's an OUTFLOW.
    If the word before it is "$" or nothing, it's INFLOW.
    """
    if not row_words:
        return None

    # Find the last word that contains digits (the amount)
    last_numeric_idx = None
    for i in range(len(row_words) - 1, -1, -1):
        if re.search(r"\d", row_words[i]["text"]):
            last_numeric_idx = i
            break

    if last_numeric_idx is None:
        return None

    # Check if there's a sign word right before it
    is_outflow = False
    if last_numeric_idx > 0:
        prev_word = row_words[last_numeric_idx - 1]["text"].strip()
        if "-" in prev_word:  # "-$", "-", "$-", etc.
            is_outflow = True

    return (last_numeric_idx, is_outflow)


def _is_reference(word: str) -> bool:
    """Check if a word is a reference number (8-12 digits)."""
    return bool(REFERENCE_RE.match(word.strip()))


def _format_description_with_counterparty(words: list[dict]) -> str:
    """Format description from words, detecting repeated patterns (counterparty info).

    If the description contains a repeated prefix (e.g., "TRANSF QR" appears twice),
    format it with a " · " separator: "TRANSF QR · TRANSF QR CENTRO INTEGRAL DE S"

    Args:
        words: List of word dicts to format into description

    Returns:
        Formatted description string
    """
    if not words:
        return ""

    texts = [w["text"] for w in words]

    # Check for repeated patterns: if any word appears twice, split there
    for i in range(1, len(texts)):
        if texts[i] == texts[0]:
            # Found a repeat point: format as "first_part · second_part"
            first_part = " ".join(texts[:i])
            second_part = " ".join(texts[i:])
            return f"{first_part} · {second_part}"

    # No repeat pattern found; return as-is
    return " ".join(texts)


def parse_bancolombia_web(
    image_path: str | None = None,
    ocr_text: str | None = None,
    screenshot_date: date | None = None,
) -> ParsedStatement:
    """Parse Bancolombia web screenshot into a ParsedStatement.

    Args:
        image_path: Path to the image file (PNG/JPG). Either image_path or ocr_text must be provided.
        ocr_text: Pre-extracted OCR text (legacy fallback). If image_path is provided, it's used instead.
        screenshot_date: Optional reference date for the statement (unused, kept for API compatibility).

    Returns:
        ParsedStatement with transactions parsed from visual rows.
    """
    # Extract words with bounding boxes
    if image_path:
        image_path_str = str(image_path) if isinstance(image_path, Path) else image_path
        words = ocr_image_with_boxes(image_path_str)
    elif ocr_text:
        # Legacy: if only OCR text provided, fall back to the old parser
        return _parse_from_text(ocr_text, screenshot_date)
    else:
        raise ValueError("Either image_path or ocr_text must be provided")

    if not words:
        raise ValueError(
            "No se encontraron palabras en la captura de pantalla de Bancolombia."
        )

    # Group words into visual rows
    rows = group_words_into_rows(words, y_tolerance=10)

    logger.info("Parsed %s visual rows from image", len(rows))

    # Pre-scan rows to detect all explicit day numbers (for inferring missing ones)
    explicit_days: list[int | None] = []
    for row_words in rows:
        if len(row_words) >= 3:
            day_text = row_words[0]["text"].strip()
            if DAY_RE.match(day_text):
                explicit_days.append(int(day_text))
            else:
                explicit_days.append(None)
        else:
            explicit_days.append(None)

    # Parse each row as a potential transaction
    transactions: list[ParsedTransaction] = []

    for row_idx, row_words in enumerate(rows):
        if len(row_words) < 3:
            # Minimum: month, year, + at least one more word (description or amount)
            continue

        # Skip UI noise rows
        row_text = " ".join(w["text"] for w in row_words).lower()
        if any(p in row_text for p in SKIP_PATTERNS):
            continue

        # Infer missing day: if this row doesn't have an explicit day,
        # assume it's 1 day after the first non-None day we find going forward
        inferred_day = None
        if explicit_days[row_idx] is None:
            # Look ahead for the next non-None day
            for future_idx in range(row_idx + 1, len(explicit_days)):
                if explicit_days[future_idx] is not None:
                    # Infer as 1 day after that
                    inferred_day = explicit_days[future_idx] + 1
                    break

        # Try to extract date from the beginning of the row
        date_result = _extract_date_from_row_start(row_words, last_seen_day=inferred_day)
        if not date_result:
            continue

        tx_date, date_words_consumed = date_result

        # Find the amount word and sign
        amount_result = _find_amount_and_sign(row_words)
        if not amount_result:
            logger.warning("Row %s: no amount found", row_idx)
            continue

        amount_idx, is_outflow = amount_result

        # Extract the amount
        amount_word = row_words[amount_idx]["text"].strip()
        try:
            amount = parse_colombian_number(amount_word)
        except ValueError:
            logger.warning("Row %s: could not parse amount: %s", row_idx, amount_word)
            continue

        # Middle section: description + optional reference
        # From after date to before amount (excluding sign words)
        middle_start = date_words_consumed
        middle_end = amount_idx

        # Skip any sign words right before the amount
        if middle_end > middle_start and row_words[middle_end - 1]["text"].strip() in ["-$", "-", "$-", "$"]:
            middle_end -= 1

        middle_words = row_words[middle_start:middle_end]

        if not middle_words:
            logger.warning("Row %s: no middle section (description/reference)", row_idx)
            continue

        # Check if the last middle word is a reference number (8-12 digits)
        authorization_number = None
        description_words = middle_words

        if middle_words and _is_reference(middle_words[-1]["text"]):
            authorization_number = middle_words[-1]["text"].strip()
            description_words = middle_words[:-1]

        if not description_words:
            logger.warning("Row %s: no description after extracting reference", row_idx)
            continue

        # Build description from remaining words, detecting repeated patterns
        description = _format_description_with_counterparty(description_words)

        if not description:
            logger.warning("Row %s: empty description", row_idx)
            continue

        direction = (
            TransactionDirection.OUTFLOW if is_outflow
            else TransactionDirection.INFLOW
        )

        transactions.append(ParsedTransaction(
            date=tx_date,
            description=description,
            amount=amount,
            direction=direction,
            currency="COP",
            authorization_number=authorization_number,
        ))

    logger.info("Bancolombia web parsed: transactions=%s", len(transactions))

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


def _parse_from_text(
    ocr_text: str,
    screenshot_date: date | None = None,
) -> ParsedStatement:
    """Legacy parser for OCR text input (no bounding boxes).

    This is a fallback for when only raw OCR text is available.
    Use image-based parsing (ocr_image_with_boxes) for accurate results.
    """
    raise NotImplementedError(
        "Text-only parsing is not implemented for Bancolombia web screenshots. "
        "Please provide an image file instead."
    )
