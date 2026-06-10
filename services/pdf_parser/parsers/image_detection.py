"""Multi-bank image detection and routing for app screenshots.

Similar to the PDF detector system: OCR the image once, score bank-specific
signals against the text, and route to the winning parser.
"""

from __future__ import annotations

import logging
import re
from datetime import date

from models import ParsedStatement
from parsers.image_utils import ocr_image
from parsers.bancolombia_app_screenshot import parse_bancolombia_app
from parsers.bancolombia_web_screenshot import parse_bancolombia_web
from parsers.nequi_app_screenshot import parse_nequi_app
from parsers.nu_savings_app_screenshot import parse_nu_savings_app
from parsers.nu_credit_card_app_screenshot import parse_nu_credit_card_app

logger = logging.getLogger("pdf_parser.image_detector")

# Type alias for parser functions (plain assignment for Python 3.11 compat)
ImageParser = None  # documentation-only marker

IMAGE_DETECTORS: list[dict] = [
    {
        "name": "bancolombia_web",
        "signals": [
            (5, lambda t: bool(re.search(r"\d{1,2}\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+\d{4}", t, re.IGNORECASE))),
            (4, lambda t: bool(re.search(r"[$]\s*[\d.,]+", t))),
            (3, lambda t: "COMPRA EN" in t or "COBRO" in t or "TRANSFERENCIA" in t),
            (3, lambda t: "ABONO INTERESES" in t or "PAGO" in t),
        ],
        "parse": lambda text, sd: parse_bancolombia_web(text, sd),
    },
    {
        "name": "bancolombia_app",
        "signals": [
            (5, lambda t: "COP" in t and bool(re.search(r"COP\s*[+-]?\s*\$", t))),
            (3, lambda t: "CUENTA DE AHORRO" in t),
            (3, lambda t: "BANCOLOMBIA" in t),
            (4, lambda t: "TRANSFERIR PLATA" in t),
            (4, lambda t: bool(re.search(r"\d{1,2}\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+\d{4}", t))),
        ],
        "parse": lambda text, sd: parse_bancolombia_app(text, sd),
    },
    {
        "name": "nequi_app",
        "signals": [
            (5, lambda t: "NEQUI" in t or "NEQUI.COM.CO" in t),
            (5, lambda t: bool(re.search(r"\d+\s+DE\s+\w+\s+DE\s+\d{4}", t))),
            (3, lambda t: "MÁS MOVIMIENTOS" in t or "MAS MOVIMIENTOS" in t),
            (3, lambda t: "RETIRO EN" in t or "RECARGA EN" in t or "PAGO DE" in t),
        ],
        "parse": lambda text, sd: parse_nequi_app(text, sd),
    },
    {
        "name": "nu_savings_app",
        "signals": [
            (4, lambda t: "BUSCAR MOVIMIENTO" in t),
            (4, lambda t: "ENVIASTE A" in t or "RECIBISTE DE" in t),
            (3, lambda t: "CAJITA" in t or "RETIRASTE DINERO" in t),
            (4, lambda t: bool(re.search(r"\d{1,2}\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s*-\s*\d{1,2}:\d{2}", t))),
            (3, lambda t: bool(re.search(r"[+-]\$\s*[\d.,]+", t))),
        ],
        "parse": lambda text, sd: parse_nu_savings_app(text, sd),
    },
    {
        "name": "nu_credit_card_app",
        "signals": [
            (5, lambda t: "GRACIAS POR TU PAGO" in t),
            (5, lambda t: bool(re.search(r"PAGASTE\s+\$", t))),
            (4, lambda t: bool(re.search(r"A\s+\d+\s+MESES", t))),
            (3, lambda t: bool(re.search(r"COMISIÓN POR", t)) or bool(re.search(r"COMISION POR", t))),
        ],
        "parse": lambda text, sd: parse_nu_credit_card_app(text, sd),
    },
]

MIN_CONFIDENCE = 6


def detect_and_parse_image(
    image_path: str,
    screenshot_date: date | None = None,
) -> list[ParsedStatement]:
    """OCR an image, detect the bank app, and parse transactions.

    Returns a list of ParsedStatement (single item) for consistency
    with the PDF parser return type.
    """
    ocr_text = ocr_image(image_path)
    text_upper = ocr_text.upper()

    logger.info("Image OCR sample (first 300 chars): %s", text_upper[:300])

    # Score every detector
    scored: list[tuple[int, dict]] = []
    for detector in IMAGE_DETECTORS:
        score = sum(w for w, fn in detector["signals"] if fn(text_upper))
        if score > 0:
            scored.append((score, detector))

    if not scored:
        logger.warning("No image detector match found")
        raise ValueError(
            "No se pudo detectar el banco de esta captura de pantalla. "
            "Bancos soportados: Bancolombia, Nequi, Nu (cuenta y tarjeta de crédito)."
        )

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_detector = scored[0]
    top_candidates = [f"{d['name']}:{s}" for s, d in scored[:3]]
    logger.info("Image detector scores (top): %s", ", ".join(top_candidates))

    if best_score < MIN_CONFIDENCE:
        logger.warning(
            "Image detector confidence too low: detector=%s score=%s min=%s",
            best_detector["name"],
            best_score,
            MIN_CONFIDENCE,
        )
        raise ValueError(
            f"No se pudo detectar el banco con suficiente confianza "
            f"(mejor candidato: {best_detector['name']}, puntaje: {best_score}/{MIN_CONFIDENCE}). "
            f"Bancos soportados: Bancolombia, Nequi, Nu (cuenta y tarjeta de crédito)."
        )

    logger.info(
        "Selected image detector: %s (score=%s)",
        best_detector["name"],
        best_score,
    )

    statement = best_detector["parse"](ocr_text, screenshot_date)
    return [statement]
