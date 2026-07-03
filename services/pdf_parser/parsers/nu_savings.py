"""NU Colombia Cuenta Nu (savings account) PDF parser.

Parses NU Colombia savings account statements (password-protected PDFs).
Number format: Colombian style (period = thousands, comma = decimal) e.g. $1.234,56
Date format: DD - DD MES AAAA (e.g. "01 - 30 JUN 2026")
Spanish month abbreviations: ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic
Transactions may be empty ("No hiciste movimientos con tu Cuenta Nu este mes")
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

# --- Spanish month abbreviations to number ---
SPANISH_MONTHS: dict[str, int] = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4,
    "may": 5, "jun": 6, "jul": 7, "ago": 8,
    "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}

# --- Regex patterns ---

# Period: "01 - 30 JUN 2026"
PERIOD_RE = re.compile(
    r"(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{4})",
    re.IGNORECASE,
)

# Summary patterns (Colombian format, optional whitespace after $)
SUMMARY_PATTERNS: dict[str, re.Pattern] = {
    "previous_balance": re.compile(r"tu\s+dinero\s+al\s+inicio\s+del\s+mes\s+\$\s*([\d.,]+)", re.IGNORECASE),
    "final_balance": re.compile(r"tu\s+dinero\s+a\s+final\s+del\s+mes\s+\$\s*([\d.,]+)", re.IGNORECASE),
    "total_credits": re.compile(r"lo\s+que\s+entr[óo]\s+a\s+tu\s+cuenta\s+\$\s*([\d.,]+)", re.IGNORECASE),
    "total_debits": re.compile(r"lo\s+que\s+sali[óo]\s+de\s+tu\s+cuenta\s+\$\s*([\d.,]+)", re.IGNORECASE),
}


def _parse_colombian_number(s: str) -> float:
    """Parse Colombian-formatted number: 1.234,56 → 1234.56

    Removes periods (thousands separators) and replaces comma with period (decimal).
    """
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    # Remove periods (thousands), replace comma with period (decimal)
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        # Malformed capture (e.g. "1,234,56") — treat as 0 rather than
        # aborting the whole statement parse.
        return 0.0


def parse_nu_savings(
    pdf_path: str, password: str | None = None
) -> ParsedStatement:
    """Parse NU Colombia savings account statement.

    Returns a ParsedStatement with metadata and (possibly empty) transaction list.
    Statements with no movements are valid — the summary serves as content.
    """
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

        full_text_upper = full_text.upper()

        # --- Extract account number (8 digits, usually after "Número de Cuenta") ---
        lines = full_text.split("\n")
        for i, line in enumerate(lines[:30]):  # Check first 30 lines
            if "NÚMERO DE CUENTA" in line.upper():
                # Account number is usually in the same line or next line
                candidates = [line]
                if i + 1 < len(lines):
                    candidates.append(lines[i + 1])
                for candidate in candidates:
                    matches = re.findall(r"\b(\d{8})\b", candidate)
                    if matches:
                        account_number = matches[0]
                        break
            if account_number:
                break

        # --- Extract period ---
        period_match = PERIOD_RE.search(full_text)
        if period_match:
            day_start = int(period_match.group(1))
            day_end = int(period_match.group(2))
            month_abbr = period_match.group(3).lower()
            year = int(period_match.group(4))

            month = SPANISH_MONTHS.get(month_abbr, 0)
            if month:
                try:
                    period_from = date(year, month, day_start)
                    period_to = date(year, month, day_end)
                except ValueError:
                    # Corrupt extraction (e.g. day 31 in a 30-day month) —
                    # leave the period unset instead of crashing the parse.
                    pass

        # --- Extract summary from full text ---
        for key, pattern in SUMMARY_PATTERNS.items():
            m = pattern.search(full_text_upper)
            if m:
                setattr(summary, key, _parse_colombian_number(m.group(1)))

        # --- Extract transactions (if any) ---
        # Tolerate statements with no movements: "No hiciste movimientos con tu Cuenta Nu este mes"
        if "NO HICISTE MOVIMIENTOS" not in full_text_upper:
            # If there are movements, parse them (pattern TBD without sample transaction data)
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if not row or len(row) < 4:
                            continue

                        date_str = (row[0] or "").strip()
                        if not date_str or "/" not in date_str:
                            continue

                        try:
                            # Try parsing DD/MM/YYYY
                            day, month, year = date_str.split("/")
                            tx_date = date(int(year), int(month), int(day))
                        except (ValueError, IndexError):
                            continue

                        description = (row[1] or "").strip()
                        amount_str = (row[2] or "").strip()

                        # "$" anywhere, not startswith — negatives come as "-$10.000,00"
                        if not amount_str or "$" not in amount_str:
                            continue

                        amount_val = _parse_colombian_number(amount_str)
                        if amount_val < 0:
                            direction = TransactionDirection.OUTFLOW
                            amount_val = abs(amount_val)
                        else:
                            direction = TransactionDirection.INFLOW

                        if amount_val == 0:
                            continue

                        balance_str = (row[3] or "").strip() if len(row) > 3 else None
                        balance = (
                            _parse_colombian_number(balance_str)
                            if balance_str and "$" in balance_str
                            else None
                        )

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

    return ParsedStatement(
        bank="nu",
        statement_type=StatementType.SAVINGS,
        account_number=account_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=summary,
        transactions=transactions,
    )
