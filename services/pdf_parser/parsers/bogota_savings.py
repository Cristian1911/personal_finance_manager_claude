"""Banco de Bogotá Cuenta de Ahorros (savings account) PDF parser.

Parses Banco de Bogotá savings account statements.
Number format: TBD (to be determined from sample PDFs)
Date format: TBD
"""

from __future__ import annotations

import re
from datetime import date

import pdfplumber

from models import (
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

# --- Regex patterns (to be filled from sample PDFs) ---
# PERIOD_RE = re.compile(r"...")
# ACCOUNT_RE = re.compile(r"...")
# TRANSACTION_RE = re.compile(r"...")


def parse_bogota_savings(
    pdf_path: str, password: str | None = None
) -> ParsedStatement:
    """Parse Banco de Bogotá savings account statement."""
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    account_number: str | None = None
    summary = StatementSummary()

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")

            for line in lines:
                # TODO: Extract period dates
                # TODO: Extract account number
                # TODO: Extract summary fields
                # TODO: Parse transaction lines
                pass

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en el extracto de Banco de Bogotá."
        )

    return ParsedStatement(
        bank="banco_de_bogota",
        statement_type=StatementType.SAVINGS,
        account_number=account_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=summary,
        transactions=transactions,
    )
