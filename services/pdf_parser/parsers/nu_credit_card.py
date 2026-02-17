"""NU Colombia Tarjeta de Crédito (credit card) PDF parser.

Parses NU Colombia credit card statements.
Number format: TBD (to be determined from sample PDFs)
Date format: TBD
"""

from __future__ import annotations

import re
from datetime import date

import pdfplumber

from models import (
    CreditCardMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

# --- Regex patterns (to be filled from sample PDFs) ---
# PERIOD_RE = re.compile(r"...")
# CARD_NUMBER_RE = re.compile(r"...")
# TRANSACTION_RE = re.compile(r"...")


def parse_nu_credit_card(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement]:
    """Parse NU Colombia credit card statement.

    Returns a list (may contain multiple currency sections).
    """
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    card_last_four: str | None = None
    summary = StatementSummary()
    metadata = CreditCardMetadata()

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")

            for line in lines:
                # TODO: Extract period dates
                # TODO: Extract card number
                # TODO: Extract summary fields (saldo anterior, compras, intereses)
                # TODO: Extract credit card metadata (cupo, disponible, tasa)
                # TODO: Parse transaction lines
                pass

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en el extracto de NU Colombia."
        )

    return [
        ParsedStatement(
            bank="nu",
            statement_type=StatementType.CREDIT_CARD,
            card_last_four=card_last_four,
            period_from=period_from,
            period_to=period_to,
            currency="COP",
            summary=summary,
            credit_card_metadata=metadata,
            transactions=transactions,
        )
    ]
