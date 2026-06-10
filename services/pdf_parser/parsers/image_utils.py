"""Shared utilities for app screenshot parsers."""

from __future__ import annotations

import logging
import re
from datetime import date, timedelta

from PIL import Image
import pytesseract

logger = logging.getLogger("pdf_parser.image_utils")

# Spanish month abbreviations → month number
MONTH_MAP: dict[str, int] = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4,
    "may": 5, "jun": 6, "jul": 7, "ago": 8,
    "sep": 9, "oct": 10, "nov": 11, "dic": 12,
    # Full names (OCR sometimes outputs these)
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}

# Spanish day names → weekday number (Monday=0)
DAY_NAME_MAP: dict[str, int] = {
    "lunes": 0, "martes": 1, "miércoles": 2, "miercoles": 2,
    "jueves": 3, "viernes": 4, "sábado": 5, "sabado": 5,
    "domingo": 6,
}

# OCR often reads app icons as short chars at the start of lines
ICON_ARTIFACT_RE = re.compile(r"^[A-Za-z0-9@#<>(){}[\]*=+\-_|!?]{1,3}[\s)]+")


def parse_colombian_number(s: str) -> float:
    """Parse Colombian-formatted number: 30.000,00 → 30000.00

    Also handles OCR artifacts:
    - Space instead of comma for decimals: "43.627 81" → 43627.81
    - Missing comma: "43.62781" (concatenated)
    - Dollar sign prefix: "$3,06" → 3.06
    """
    s = s.strip()

    # Remove any dollar signs
    s = s.replace("$", "")

    # Handle space-separated decimals: "43.627 81" → "43.627,81"
    s = re.sub(r"(\d)\s+(\d{2})$", r"\1,\2", s)

    # Replace Colombian format: periods (thousands) → "", comma (decimal) → "."
    cleaned = s.replace(".", "").replace(",", ".")
    return float(cleaned)


def strip_icon_artifacts(line: str) -> str:
    """Remove OCR artifacts from app icons at the start of a line.

    Examples: "E Enviaste a" → "Enviaste a", "0) Recarga" → "Recarga",
    "a Claude.Ai" → "Claude.Ai", "uy  Novaventa" → "Novaventa"
    """
    return ICON_ARTIFACT_RE.sub("", line).strip()


def ocr_image(image_path: str) -> str:
    """OCR a screenshot image and return the extracted text."""
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img, lang="spa", config="--psm 4")
    logger.info("OCR completed: image=%s chars=%s", image_path, len(text))
    return text


def ocr_image_with_boxes(image_path: str) -> list[dict]:
    """OCR an image and return words with bounding boxes.

    Returns a list of dicts: {text, left, top, right, bottom}
    Each dict represents a single word with its pixel coordinates.
    Coordinates: top-left is (0, 0), x increases rightward, y increases downward.
    """
    img = Image.open(image_path)
    data = pytesseract.image_to_data(img, lang="spa", output_type=pytesseract.Output.DICT)

    words = []
    for i in range(len(data["text"])):
        word = data["text"][i].strip()
        if word:  # Skip empty strings
            words.append({
                "text": word,
                "left": data["left"][i],
                "top": data["top"][i],
                "width": data["width"][i],
                "height": data["height"][i],
            })

    logger.info("OCR with boxes completed: image=%s words=%s", image_path, len(words))
    return words


def group_words_into_rows(words: list[dict], y_tolerance: int = 10) -> list[list[dict]]:
    """Group words into visual rows by clustering on y-coordinate (top).

    Words with similar y-coordinates (within y_tolerance pixels) are grouped together.
    Within each row, words are sorted left-to-right by x-coordinate.

    Args:
        words: List of word dicts with keys: text, left, top, width, height
        y_tolerance: Maximum y-distance (pixels) to group words into the same row

    Returns:
        List of rows, where each row is a list of words sorted by x-position
    """
    if not words:
        return []

    # Sort words by top-coordinate (y-axis) first
    sorted_words = sorted(words, key=lambda w: w["top"])

    rows = []
    current_row = [sorted_words[0]]

    for word in sorted_words[1:]:
        # If this word's top is within tolerance of the current row's top, add to row
        if abs(word["top"] - current_row[0]["top"]) <= y_tolerance:
            current_row.append(word)
        else:
            # Start a new row
            rows.append(sorted(current_row, key=lambda w: w["left"]))  # Sort by x within row
            current_row = [word]

    # Don't forget the last row
    if current_row:
        rows.append(sorted(current_row, key=lambda w: w["left"]))

    return rows


def resolve_relative_date(label: str, reference_date: date) -> date | None:
    """Resolve relative day labels ('Ayer', 'Hoy', 'Domingo') to a date.

    For day names, returns the most recent past occurrence relative to
    reference_date (or reference_date itself if it falls on that day).
    """
    lower = label.lower().strip()

    if lower == "hoy":
        return reference_date
    if lower == "ayer":
        return reference_date - timedelta(days=1)

    weekday = DAY_NAME_MAP.get(lower)
    if weekday is not None:
        ref_weekday = reference_date.weekday()
        days_back = (ref_weekday - weekday) % 7
        if days_back == 0:
            days_back = 7  # "Domingo" on a Sunday means last Sunday
        return reference_date - timedelta(days=days_back)

    return None
