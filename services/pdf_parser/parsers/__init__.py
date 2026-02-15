from __future__ import annotations

import pdfplumber

from models import ParsedStatement
from parsers.bancolombia_savings import parse_savings
from parsers.bancolombia_credit_card import parse_credit_card


def detect_and_parse(pdf_path: str) -> list[ParsedStatement]:
    """Detect statement type and parse accordingly.

    Returns a list because credit card PDFs can contain
    multiple currency sections (e.g. COP + USD).
    """
    with pdfplumber.open(pdf_path) as pdf:
        # Sample first 3 pages to detect type
        sample_text = ""
        for page in pdf.pages[:3]:
            text = page.extract_text() or ""
            sample_text += text + "\n"

    sample_upper = sample_text.upper()

    if "CUENTA DE AHORROS" in sample_upper:
        return [parse_savings(pdf_path)]

    if "TARJETA" in sample_upper or "MASTERCARD" in sample_upper:
        return parse_credit_card(pdf_path)

    raise ValueError(
        "No se pudo detectar el tipo de extracto. "
        "Formatos soportados: Bancolombia Cuenta de Ahorros, "
        "Bancolombia Tarjeta de Crédito."
    )
