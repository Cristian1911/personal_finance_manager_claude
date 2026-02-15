"""Bancolombia Cuenta de Ahorros (savings account) PDF parser.

Parses digital Bancolombia savings statements with monospace-style tables.
Number format: US style (comma = thousands, period = decimal) e.g. 1,234,567.89
Date format in table: D/MM or DD/MM (year inferred from header period)
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

# Two decimal numbers at end of line: valor + saldo
NUMBERS_AT_END = re.compile(r"(-?[\d,]*\.\d{2})\s+([\d,]*\.\d{2})\s*$")

# Date at start of line: D/MM or DD/MM
DATE_AT_START = re.compile(r"^\s*(\d{1,2}/\d{2})\s+")

# Header metadata
PERIOD_RE = re.compile(r"DESDE:\s*(\d{4}/\d{2}/\d{2})\s+HASTA:\s*(\d{4}/\d{2}/\d{2})")
ACCOUNT_RE = re.compile(r"NÚMERO\s+(\d+)")

# Summary section
SUMMARY_RE = re.compile(
    r"(SALDO ANTERIOR|TOTAL ABONOS|TOTAL CARGOS|SALDO ACTUAL)"
    r"\s+\$\s+([\d,]*\.?\d+)"
)


def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    return float(s.replace(",", ""))


def _resolve_year(tx_month: int, from_date: date, to_date: date) -> int:
    """Resolve transaction year from month, handling Dec→Jan boundary."""
    if from_date.year == to_date.year:
        return from_date.year
    # Year boundary: e.g. from=2025-12-01, to=2026-01-31
    if tx_month >= from_date.month:
        return from_date.year
    return to_date.year


def parse_savings(pdf_path: str) -> ParsedStatement:
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    account_number: str | None = None
    summary_data: dict[str, float] = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            for line in text.split("\n"):
                # --- Extract metadata (first page) ---
                if not period_from:
                    period_match = PERIOD_RE.search(line)
                    if period_match:
                        period_from = date.fromisoformat(
                            period_match.group(1).replace("/", "-")
                        )
                        period_to = date.fromisoformat(
                            period_match.group(2).replace("/", "-")
                        )

                if not account_number:
                    account_match = ACCOUNT_RE.search(line)
                    if account_match:
                        account_number = account_match.group(1)

                # Summary lines
                summary_match = SUMMARY_RE.search(line)
                if summary_match:
                    summary_data[summary_match.group(1)] = _parse_us_number(
                        summary_match.group(2)
                    )

                # --- Parse transaction lines ---
                if "FIN ESTADO DE CUENTA" in line:
                    continue

                numbers_match = NUMBERS_AT_END.search(line)
                if not numbers_match:
                    continue

                date_match = DATE_AT_START.match(line)
                if not date_match:
                    continue

                # Date
                day_str, month_str = date_match.group(1).split("/")
                tx_month = int(month_str)
                tx_day = int(day_str)

                if period_from and period_to:
                    tx_year = _resolve_year(tx_month, period_from, period_to)
                else:
                    tx_year = date.today().year

                tx_date = date(tx_year, tx_month, tx_day)

                # Description: everything between date and numbers
                description = line[date_match.end() : numbers_match.start()].strip()

                # Value and balance
                valor = _parse_us_number(numbers_match.group(1))
                saldo = _parse_us_number(numbers_match.group(2))

                direction = (
                    TransactionDirection.INFLOW
                    if valor >= 0
                    else TransactionDirection.OUTFLOW
                )

                transactions.append(
                    ParsedTransaction(
                        date=tx_date,
                        description=description,
                        amount=abs(valor),
                        direction=direction,
                        balance=saldo,
                        currency="COP",
                    )
                )

    return ParsedStatement(
        statement_type=StatementType.SAVINGS,
        account_number=account_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=StatementSummary(
            previous_balance=summary_data.get("SALDO ANTERIOR"),
            total_credits=summary_data.get("TOTAL ABONOS"),
            total_debits=summary_data.get("TOTAL CARGOS"),
            final_balance=summary_data.get("SALDO ACTUAL"),
        ),
        transactions=transactions,
    )
