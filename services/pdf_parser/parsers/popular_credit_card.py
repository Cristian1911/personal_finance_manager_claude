"""Banco Popular Tarjeta de Crédito (credit card) PDF parser.

Parses Banco Popular credit card statements.
Page 1 is typically an image; data is extracted from page 2+.
Number format: US style (comma = thousands, period = decimal) e.g. 12,947,600.00
Date format in table: DD/MMM/YYYY (e.g. 07/DIC/2024)
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

from parsers.utils import SPANISH_MONTHS

# --- Regex patterns ---

# Card number (16 digits unique on page)
# "5361709974512905"
CARD_NUMBER_RE = re.compile(r"\b(\d{16})\b")

# Date pattern: "17/FEB/2026" or "31/ENE/2026"
DATE_RE = re.compile(r"(\d{1,2})/([A-Z]{3})/(\d{4})")

# "Saldo anterior 13,101,891.00"
PREV_BALANCE_RE = re.compile(r"Saldo\s+anterior\s+([\d,.]+)", re.IGNORECASE)

# "+ Intereses corrientes 195,966.00"
INTEREST_CHARGED_RE = re.compile(r"\+\s*Intereses\s+corrientes\s+([\d,.]+)", re.IGNORECASE)

# Transaction line
# 07/DIC/2024 001072 SOFISTIK DA 3,780,000.00 210,000.00 1,260,000.00 18 12 26.389
TX_LINE_RE = re.compile(
    r"^(\d{2}/[A-Z]{3}/\d{4})\s+"  # Date
    r"(\d+)\s+"                    # Auth
    r"(.+?)\s+"                    # Description
    r"([\d,.]+)\s+"                # Original Amount
    r"([\d,.]+)\s+"                # Monthly Payment / Other
    r"([\d,.]+)\s+"                # Balance / Pending
    r"(\d+)\s+"                    # Term Total
    r"(\d+)\s+"                    # Term Current/Rem
    r"([\d,.]+)"                   # Rate
)

# Payments usually have specific descriptions or negative signs?
# Sample: "05/ENE/2026 ... GRACIAS POR SU PAGO PSE -1,080,000.00 ..."
# The regex above expects positive numbers for the amounts usually.
# But for payment line: "-1,080,000.00"
# We need to handle negative sign in amounts.
TX_PAYMENT_RE = re.compile(
    r"^(\d{2}/[A-Z]{3}/\d{4})\s+"  # Date
    r"(\d+)\s+"                    # Auth
    r"(.+?)\s+"                    # Description
    r"(-?[\d,.]+)\s+"              # Amount 1
    r"(-?[\d,.]+)\s+"              # Amount 2
    r"([\d,.]+)\s+"                # Amount 3 (Balance 0.00)
    r"(\d+)\s+"                    # Term
    r"(\d+)\s+"                    # Term
    r"([\d,.]+)"                   # Rate
)


def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    return float(s.replace(",", ""))

def _parse_date(s: str) -> date | None:
    """Parse 17/FEB/2026"""
    m = DATE_RE.match(s)
    if not m:
        return None
    day = int(m.group(1))
    month_str = m.group(2).lower()
    year = int(m.group(3))
    month = SPANISH_MONTHS.get(month_str, 0)
    if month == 0:
        return None
    return date(year, month, day)

def parse_popular_credit_card(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement]:
    """Parse Banco Popular credit card statement."""
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    card_last_four: str | None = None
    summary = StatementSummary()
    metadata = CreditCardMetadata()
    last_standalone_amount: float | None = None

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")

            for line in lines:
                stripped = line.strip()

                # --- Metadata ---
                if not card_last_four:
                    m = CARD_NUMBER_RE.search(stripped)
                    if m:
                        card_last_four = m.group(1)[-4:]

                # Summary fields
                if not summary.previous_balance:
                    m = PREV_BALANCE_RE.search(stripped)
                    if m:
                        summary.previous_balance = _parse_us_number(m.group(1))

                if not summary.interest_charged:
                    m = INTEREST_CHARGED_RE.search(stripped)
                    if m:
                        summary.interest_charged = _parse_us_number(m.group(1))

                # Standalone date line (e.g. "17/FEB/2026") → payment due date
                if len(stripped) < 20 and DATE_RE.match(stripped):
                    d = _parse_date(stripped)
                    if d and not metadata.payment_due_date:
                        metadata.payment_due_date = d

                # Track last standalone amount (e.g. "12,947,600.00") for total due heuristic
                if re.match(r"^[\d,.]+$", stripped):
                    last_standalone_amount = _parse_us_number(stripped)

                # "18,000,000.00 31/ENE/2026" → credit limit + statement cut date
                m_credit = re.match(r"^([\d,.]+)\s+(\d{2}/[A-Z]{3}/\d{4})$", stripped)
                if m_credit and not metadata.credit_limit:
                    metadata.credit_limit = _parse_us_number(m_credit.group(1))
                    d = _parse_date(m_credit.group(2))
                    if d and not period_to:
                        period_to = d
                        try:
                            period_from = (
                                d.replace(month=d.month - 1)
                                if d.month > 1
                                else d.replace(year=d.year - 1, month=12)
                            )
                        except ValueError:
                            pass
                    # The last standalone amount seen before this line is total payment due
                    if last_standalone_amount and not metadata.total_payment_due:
                        metadata.total_payment_due = last_standalone_amount
                        summary.final_balance = last_standalone_amount

                # --- Transactions ---
                m = TX_PAYMENT_RE.match(stripped)
                if m:
                    date_str = m.group(1)
                    auth = m.group(2)
                    desc = m.group(3).strip()
                    amount_str = m.group(4)
                    term_total = m.group(7)
                    term_current = m.group(8)

                    try:
                        tx_date = _parse_date(date_str)
                        if not tx_date:
                            continue
                            
                        amount = _parse_us_number(amount_str)
                        
                        direction = TransactionDirection.OUTFLOW
                        # Logic: Negative amount is payment (INFLOW)
                        if amount < 0:
                            direction = TransactionDirection.INFLOW
                            amount = abs(amount)
                        elif "PAGO" in desc.upper():
                             direction = TransactionDirection.INFLOW
                        
                        installment_current = None
                        installment_total = None
                        if term_total != "00":
                            installment_current = int(term_current)
                            installment_total = int(term_total)

                        transactions.append(
                            ParsedTransaction(
                                date=tx_date,
                                description=desc,
                                amount=amount,
                                direction=direction,
                                balance=None, # Balance logic is tricky in this format
                                authorization_number=auth,
                                installment_current=installment_current,
                                installment_total=installment_total,
                                currency="COP",
                            )
                        )
                    except ValueError:
                        continue

    # Note: Summary fields like Total Payment are hard to extract reliably 
    # from the jumbled text without headers. We skip them if uncertain.

    return [
        ParsedStatement(
            bank="banco_popular",
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
