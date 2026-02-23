from __future__ import annotations

import re

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


# ---------------------------------------------------------------------------
# Multi-signal scoring detection
#
# Each detector defines weighted signals (regex / keyword checks).  The
# detector with the highest combined score wins.  A minimum score of 6 is
# required so that a bank name appearing in a transaction description alone
# (weight 3) is never enough to trigger a false match.
# ---------------------------------------------------------------------------

DETECTORS: list[dict] = [
    # -- Bancolombia Savings --
    {
        "name": "bancolombia_savings",
        "signals": [
            (3, lambda t: "BANCOLOMBIA" in t),
            (3, lambda t: "CUENTA DE AHORROS" in t),
            (5, lambda t: bool(re.search(r"DESDE:\s*\d{4}/\d{2}/\d{2}\s+HASTA:", t))),
            (4, lambda t: "SALDO ANTERIOR" in t and "TOTAL ABONOS" in t),
            (4, lambda t: bool(re.search(r"NÚMERO\s+\d+", t))),
        ],
        "parse": lambda path, pw: [parse_savings(path, password=pw)],
    },
    # -- Bancolombia Credit Card --
    {
        "name": "bancolombia_credit_card",
        "signals": [
            (3, lambda t: "BANCOLOMBIA" in t),
            (5, lambda t: bool(re.search(r"TARJETA:\s*\*+\d{4}", t))),
            (5, lambda t: bool(re.search(r"ESTADO DE CUENTA EN\s*:", t))),
            (3, lambda t: "NUEVOS MOVIMIENTOS" in t),
        ],
        "parse": lambda path, pw: parse_credit_card(path, password=pw),
    },
    # -- Bancolombia Loan --
    {
        "name": "bancolombia_loan",
        "signals": [
            (3, lambda t: "BANCOLOMBIA" in t),
            (5, lambda t: bool(re.search(r"OBLIGACIÓN\s+Nº:\s*\d+", t))),
            (4, lambda t: "LÍNEA DE CRÉDITO" in t),
            (4, lambda t: "INFORMACIÓN DEL CRÉDITO" in t),
        ],
        "parse": lambda path, pw: [parse_loan(path, password=pw)],
    },
    # -- NU Colombia Credit Card --
    {
        "name": "nu_credit_card",
        "signals": [
            (3, lambda t: "NU FINANCIERA" in t or "NU COLOMBIA" in t or "NUBANK" in t),
            (5, lambda t: "•" in t and bool(re.search(r"•\s*\d{4}", t))),
            (5, lambda t: bool(re.search(r"PERIODO\s+FACTURADO", t))),
            (4, lambda t: "TU CUPO DEFINIDO" in t),
        ],
        "parse": lambda path, pw: parse_nu_credit_card(path, password=pw),
    },
    # -- Lulo Bank Loan --
    {
        "name": "lulo_loan",
        "signals": [
            (3, lambda t: "LULO BANK" in t),
            (5, lambda t: bool(re.search(r"\d{11,}\s+\d+\s+DE\s+\d+", t))),
            (4, lambda t: "MONTO SOLICITADO" in t),
            (4, lambda t: "MIS PAGOS" in t),
        ],
        "parse": lambda path, pw: [parse_lulo_loan(path, password=pw)],
    },
    # -- Davivienda Loan --
    {
        "name": "davivienda_loan",
        "signals": [
            (3, lambda t: "DAVIVIENDA" in t),
            (5, lambda t: bool(re.search(r"NO\s+DEL\s+CRÉDITO:\s*[\d-]+", t))),
            (5, lambda t: bool(re.search(r"PÁGUESE\s+ANTES\s+DEL", t))),
        ],
        "parse": lambda path, pw: [parse_davivienda_loan(path, password=pw)],
    },
    # -- Banco Popular Credit Card --
    {
        "name": "popular_credit_card",
        "signals": [
            (3, lambda t: "BANCO POPULAR" in t or "BANCOPOPULAR" in t),
            (5, lambda t: bool(re.search(r"\b\d{16}\b", t))),
            (4, lambda t: bool(re.search(r"\d{2}/[A-Z]{3}/\d{4}", t))),
        ],
        "parse": lambda path, pw: parse_popular_credit_card(path, password=pw),
    },
    # -- Falabella Credit Card --
    {
        "name": "falabella_credit_card",
        "signals": [
            (3, lambda t: "FALABELLA" in t or "CMR" in t),
            (5, lambda t: bool(re.search(r"PAGA\s+ANTES\s+DEL", t))),
            (4, lambda t: bool(re.search(r"HAS\s+UTILIZADO:", t))),
            (4, lambda t: bool(re.search(r"CUPO\s+TOTAL\s+DE\s+TU\s+TARJETA:", t))),
        ],
        "parse": lambda path, pw: parse_falabella_credit_card(path, password=pw),
    },
    # -- Banco de Bogotá Credit Card --
    {
        "name": "bogota_credit_card",
        "signals": [
            (3, lambda t: "BANCO DE BOGOT" in t or "BANCODEBOGOTA" in t),
            (5, lambda t: bool(re.search(r"TARJETA\s+NÚMERO\s+\d+", t))),
            (4, lambda t: bool(re.search(r"COMPRAS\s+[\d,.]+\s+[\d,.]+", t))),
            (3, lambda t: "TARJETA" in t or "MASTERCARD" in t or "VISA" in t),
        ],
        "parse": lambda path, pw: parse_bogota_credit_card(path, password=pw),
    },
    # -- Banco de Bogotá Loan --
    {
        "name": "bogota_loan",
        "signals": [
            (3, lambda t: "BANCO DE BOGOT" in t or "BANCODEBOGOTA" in t),
            (5, lambda t: bool(re.search(r"NÚMERO\s+DE\s+CRÉDITO\s*\d+", t))),
            (4, lambda t: "CRÉDITO DE VIVIENDA" in t),
            (4, lambda t: "DATOS GENERALES DEL CRÉDITO" in t),
        ],
        "parse": lambda path, pw: [parse_bogota_loan(path, password=pw)],
    },
    # -- Banco de Bogotá Savings (lowest priority for Bogotá — fallback) --
    {
        "name": "bogota_savings",
        "signals": [
            (3, lambda t: "BANCO DE BOGOT" in t or "BANCODEBOGOTA" in t),
            (3, lambda t: "BANCO DE BOGOTA" in t),
        ],
        "parse": lambda path, pw: [parse_bogota_savings(path, password=pw)],
    },
]

MIN_CONFIDENCE = 6


def detect_and_parse(pdf_path: str, password: str | None = None) -> list[ParsedStatement]:
    """Detect statement type via multi-signal scoring and parse accordingly.

    Each bank/type detector contributes weighted signals (branding, account
    number patterns, structural markers).  The detector with the highest
    combined score wins, provided it meets the minimum confidence threshold.

    Returns a list because credit-card PDFs can contain multiple currency
    sections (e.g. COP + USD).
    """
    with pdfplumber.open(pdf_path, password=password) as pdf:
        sample_text = ""
        for page in pdf.pages[:3]:
            try:
                text = page.extract_text() or ""
                sample_text += text + "\n"
            except Exception:
                pass

    sample_upper = sample_text.upper()

    # Score every detector
    scored: list[tuple[int, dict]] = []
    for detector in DETECTORS:
        score = sum(w for w, fn in detector["signals"] if fn(sample_upper))
        if score > 0:
            scored.append((score, detector))

    if not scored:
        raise ValueError(
            "No se pudo detectar el tipo de extracto. "
            "Formatos soportados: Bancolombia (ahorros, crédito, préstamo), "
            "NU Colombia, Lulo Bank, Banco de Bogotá, Banco Popular, "
            "Davivienda, Falabella."
        )

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_detector = scored[0]

    if best_score < MIN_CONFIDENCE:
        raise ValueError(
            "No se pudo detectar el tipo de extracto con suficiente confianza "
            f"(mejor candidato: {best_detector['name']}, puntaje: {best_score}/{MIN_CONFIDENCE}). "
            "Formatos soportados: Bancolombia (ahorros, crédito, préstamo), "
            "NU Colombia, Lulo Bank, Banco de Bogotá, Banco Popular, "
            "Davivienda, Falabella."
        )

    return best_detector["parse"](pdf_path, password)
