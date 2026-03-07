"""Nequi Cuenta de Ahorro (savings account) PDF parser.

Parses Nequi savings statements (password-protected PDFs).
Number format: US style (comma = thousands, period = decimal) e.g. $22,206.00
Date format: DD/MM/YYYY
Value direction: $-amount for debits, $amount for credits
Transactions listed in reverse chronological order (newest first).
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

# --- Regex patterns ---

# "Número de cuenta de ahorro: 3173389665"
ACCOUNT_RE = re.compile(r"[Nn]úmero\s+de\s+cuenta\s+de\s+ahorro:\s*(\d+)")

# "Estado de cuenta para el período de: 2026/01/01 a 2026/01/31"
PERIOD_RE = re.compile(
    r"per[íi]odo\s+de:\s*(\d{4}/\d{2}/\d{2})\s+a\s+(\d{4}/\d{2}/\d{2})"
)

# Summary patterns
SUMMARY_PATTERNS: dict[str, re.Pattern] = {
    "previous_balance": re.compile(r"Saldo\s+anterior\s+\$([\d,.]+)"),
    "total_credits": re.compile(r"Total\s+abonos\s+\$([\d,.]+)"),
    "total_debits": re.compile(r"Total\s+cargos\s+\$([\d,.]+)"),
    "final_balance": re.compile(r"Saldo\s+actual\s+\$([\d,.]+)"),
}

# Transaction line: DD/MM/YYYY description $[-]amount $balance
# The amount and balance are at the end, with the description in between.
TX_LINE_RE = re.compile(
    r"^(\d{2}/\d{2}/\d{4})\s+"  # date
    r"(.+?)\s+"                  # description (non-greedy)
    r"\$(-?[\d,.]+)\s+"          # amount (may be negative)
    r"\$([\d,.]+)\s*$"           # balance
)


def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    return float(s.replace(",", ""))


def parse_nequi_savings(
    pdf_path: str, password: str | None = None
) -> ParsedStatement:
    """Parse Nequi savings account statement."""
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    account_number: str | None = None
    summary = StatementSummary()

    with pdfplumber.open(pdf_path, password=password) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"

            for line in text.split("\n"):
                stripped = line.strip()

                # --- Metadata ---
                if not account_number:
                    m = ACCOUNT_RE.search(stripped)
                    if m:
                        account_number = m.group(1)

                if not period_from:
                    m = PERIOD_RE.search(stripped)
                    if m:
                        period_from = date.fromisoformat(m.group(1).replace("/", "-"))
                        period_to = date.fromisoformat(m.group(2).replace("/", "-"))

                # --- Transactions ---
                tx_match = TX_LINE_RE.match(stripped)
                if tx_match:
                    date_str = tx_match.group(1)
                    description = tx_match.group(2).strip()
                    amount_str = tx_match.group(3)
                    balance_str = tx_match.group(4)

                    # Parse date DD/MM/YYYY
                    day, month, year = date_str.split("/")
                    tx_date = date(int(year), int(month), int(day))

                    amount_val = _parse_us_number(amount_str)
                    balance = _parse_us_number(balance_str)

                    if amount_val < 0:
                        direction = TransactionDirection.OUTFLOW
                        amount_val = abs(amount_val)
                    else:
                        direction = TransactionDirection.INFLOW

                    if amount_val == 0:
                        continue

                    transactions.append(
                        ParsedTransaction(
                            date=tx_date,
                            description=description,
                            amount=amount_val,
                            direction=direction,
                            balance=balance,
                            currency="COP",
                        )
                    )

        # --- Summary from full text ---
        for key, pattern in SUMMARY_PATTERNS.items():
            m = pattern.search(full_text)
            if m:
                setattr(summary, key, _parse_us_number(m.group(1)))

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en el extracto de Nequi."
        )

    return ParsedStatement(
        bank="nequi",
        statement_type=StatementType.SAVINGS,
        account_number=account_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=summary,
        transactions=transactions,
    )
