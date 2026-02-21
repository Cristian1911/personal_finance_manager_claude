from __future__ import annotations

import pdfplumber

from models import ParsedStatement
from parsers.bancolombia_savings import parse_savings
from parsers.bancolombia_credit_card import parse_credit_card
from parsers.bancolombia_loan import parse_loan
from parsers.nu_credit_card import parse_nu_credit_card
from parsers.lulo_loan import parse_lulo_loan
from parsers.bogota_savings import parse_bogota_savings
from parsers.bogota_credit_card import parse_bogota_credit_card
from parsers.bogota_loan import parse_bogota_loan
from parsers.popular_credit_card import parse_popular_credit_card
from parsers.davivienda_loan import parse_davivienda_loan
from parsers.falabella_credit_card import parse_falabella_credit_card


def detect_and_parse(pdf_path: str, password: str | None = None) -> list[ParsedStatement]:
    """Detect statement type and parse accordingly.

    Returns a list because credit card PDFs can contain
    multiple currency sections (e.g. COP + USD).

    Detection order: specific banks first, then generic Bancolombia patterns.
    """
    with pdfplumber.open(pdf_path, password=password) as pdf:
        # Sample first 3 pages to detect type
        sample_text = ""
        for page in pdf.pages[:3]:
            try:
                text = page.extract_text() or ""
                sample_text += text + "\n"
            except Exception:
                pass

    sample_upper = sample_text.upper()

    # NU Colombia
    if "NU FINANCIERA" in sample_upper or "NU COLOMBIA" in sample_upper or "NUBANK" in sample_upper or "NU PAGOS" in sample_upper:
        return parse_nu_credit_card(pdf_path, password=password)

    # Lulo Bank
    if "LULO BANK" in sample_upper or " LULO " in sample_upper:
        return [parse_lulo_loan(pdf_path, password=password)]

    # Davivienda
    if "DAVIVIENDA" in sample_upper:
        return [parse_davivienda_loan(pdf_path, password=password)]

    # Banco Popular
    if "BANCO POPULAR" in sample_upper or "BANCOPOPULAR" in sample_upper:
        return parse_popular_credit_card(pdf_path, password=password)

    # Falabella
    if "FALABELLA" in sample_upper or "CMR" in sample_upper:
        return parse_falabella_credit_card(pdf_path, password=password)

    # Banco de Bogotá
    if "BANCO DE BOGOT" in sample_upper or "BANCO DE BOGOTA" in sample_upper or "BANCODEBOGOTA" in sample_upper:
        if "CRÉDITO DE VIVIENDA" in sample_upper:
             return [parse_bogota_loan(pdf_path, password=password)]
        if "TARJETA" in sample_upper or "MASTERCARD" in sample_upper or "VISA" in sample_upper:
            return parse_bogota_credit_card(pdf_path, password=password)
        return [parse_bogota_savings(pdf_path, password=password)]

    # Bancolombia
    if "BANCOLOMBIA" in sample_upper or "CUENTA DE AHORROS" in sample_upper:
        if "LÍNEA DE CRÉDITO" not in sample_upper and "OBLIGACIÓN" not in sample_upper and "TARJETA" not in sample_upper and "MASTERCARD" not in sample_upper:
            return [parse_savings(pdf_path, password=password)]

    if "LÍNEA DE CRÉDITO" in sample_upper and "OBLIGACIÓN" in sample_upper:
        return [parse_loan(pdf_path, password=password)]

    if "TARJETA" in sample_upper or "MASTERCARD" in sample_upper:
        return parse_credit_card(pdf_path, password=password)

    raise ValueError(
        "No se pudo detectar el tipo de extracto. "
        "Formatos soportados: Bancolombia (ahorros, crédito, préstamo), NU Colombia, Lulo Bank, Banco de Bogotá, Banco Popular, Davivienda, Falabella."
    )
