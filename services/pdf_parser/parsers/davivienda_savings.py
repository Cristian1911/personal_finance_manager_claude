"""Davivienda Cuenta de Ahorros (savings account) PDF parser.

Parses Davivienda savings statements.
Number format: US style (comma = thousands, period = decimal) e.g. $49,800.00
Date format in table: DD MM (two separate columns for day and month)
Value direction: suffix +/- on the amount (e.g. $49,800.00- or $802.00+)
Period: "INFORME DEL MES: ENERO /2026" (month name in Spanish)
"""

from __future__ import annotations

import calendar
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

# --- Spanish month names (full) for period header ---
FULL_MONTHS: dict[str, int] = {
    "ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4,
    "MAYO": 5, "JUNIO": 6, "JULIO": 7, "AGOSTO": 8,
    "SEPTIEMBRE": 9, "OCTUBRE": 10, "NOVIEMBRE": 11, "DICIEMBRE": 12,
}

# "INFORMEDELMES:ENERO/2026" or "INFORME DEL MES: ENERO /2026"
PERIOD_RE = re.compile(
    r"INFORME\s*DEL\s*MES\s*:\s*([A-ZÁÉÍÓÚÑ]+)\s*/\s*(\d{4})",
    re.IGNORECASE,
)

# Account number: line with just digits (10+ digits) near the top
ACCOUNT_RE = re.compile(r"(\d{10,})")

# Summary values from text (spaces may be stripped by pdfplumber)
SUMMARY_PATTERNS: dict[str, re.Pattern] = {
    "previous_balance": re.compile(r"Saldo\s*Anterior\s*\$([\d,.]+)"),
    "total_credits": re.compile(r"M[áa]s\s*Cr[ée]ditos\s*\$([\d,.]+)"),
    "total_debits": re.compile(r"Menos\s*D[ée]bitos\s*\$([\d,.]+)"),
    "final_balance": re.compile(r"Nuevo\s*Saldo\s*\$([\d,.]+)"),
}


def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    return float(s.replace(",", ""))


def _parse_value_with_direction(val: str) -> tuple[float, TransactionDirection]:
    """Parse '$49,800.00-' or '$802.00+' into (amount, direction)."""
    val = val.strip()
    if val.endswith("-"):
        amount = _parse_us_number(val[:-1])
        return amount, TransactionDirection.OUTFLOW
    elif val.endswith("+"):
        amount = _parse_us_number(val[:-1])
        return amount, TransactionDirection.INFLOW
    else:
        amount = _parse_us_number(val)
        direction = TransactionDirection.INFLOW if amount >= 0 else TransactionDirection.OUTFLOW
        return abs(amount), direction


def parse_davivienda_savings(
    pdf_path: str, password: str | None = None
) -> ParsedStatement:
    """Parse Davivienda savings account statement."""
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

        # --- Extract metadata from full text ---
        period_match = PERIOD_RE.search(full_text)
        if period_match:
            month_name = period_match.group(1).upper()
            year = int(period_match.group(2))
            month = FULL_MONTHS.get(month_name, 0)
            if month:
                period_from = date(year, month, 1)
                last_day = calendar.monthrange(year, month)[1]
                period_to = date(year, month, last_day)

        # Account number: appears near "CUENTA DE AHORROS" on first page
        first_page_text = (pdf.pages[0].extract_text() or "") if pdf.pages else ""
        lines = first_page_text.split("\n")
        for i, line in enumerate(lines):
            if "CUENTA" in line.upper() and "AHORRO" in line.upper():
                # Check next lines for account number
                for j in range(i + 1, min(i + 3, len(lines))):
                    m = ACCOUNT_RE.search(lines[j])
                    if m:
                        raw = m.group(1)
                        # Format as groups of 4 if 12 digits
                        if len(raw) == 12:
                            account_number = f"{raw[:4]} {raw[4:8]} {raw[8:]}"
                        else:
                            account_number = raw
                        break
                if account_number:
                    break

        # --- Extract summary ---
        for key, pattern in SUMMARY_PATTERNS.items():
            m = pattern.search(full_text)
            if m:
                setattr(summary, key, _parse_us_number(m.group(1)))

        # --- Extract transactions from tables ---
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 5:
                        continue
                    day_str = (row[0] or "").strip()
                    month_str = (row[1] or "").strip()
                    value_str = (row[2] or "").strip()
                    doc_str = (row[3] or "").strip()
                    desc_str = (row[4] or "").strip()

                    # Skip header/empty rows
                    if not day_str or not day_str.isdigit() or not value_str.startswith("$"):
                        continue

                    try:
                        day = int(day_str)
                        month = int(month_str)
                    except (ValueError, TypeError):
                        continue

                    # Resolve year from period
                    if period_from and period_to:
                        if period_from.year == period_to.year:
                            year = period_from.year
                        elif month >= period_from.month:
                            year = period_from.year
                        else:
                            year = period_to.year
                    else:
                        year = date.today().year

                    try:
                        tx_date = date(year, month, day)
                    except ValueError:
                        continue

                    amount, direction = _parse_value_with_direction(value_str)
                    if amount == 0:
                        continue

                    transactions.append(
                        ParsedTransaction(
                            date=tx_date,
                            description=desc_str,
                            amount=amount,
                            direction=direction,
                            authorization_number=doc_str if doc_str and doc_str != "0000" else None,
                            currency="COP",
                        )
                    )

    if not transactions:
        raise ValueError(
            "No se encontraron transacciones en el extracto de Davivienda Ahorros."
        )

    return ParsedStatement(
        bank="davivienda",
        statement_type=StatementType.SAVINGS,
        account_number=account_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=summary,
        transactions=transactions,
    )
