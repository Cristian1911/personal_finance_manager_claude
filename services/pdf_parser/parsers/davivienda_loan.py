"""Davivienda Crédito (Loan) PDF parser.

Parses Davivienda loan statements (e.g. Crédito de Vivienda).
Number format: US style (comma = thousands, period = decimal) e.g. $254,000.00
Date format: DDMmmYYYY (e.g. 10Ene2026) or Mmm. DD/YYYY (Feb. 10/2026)
"""

from __future__ import annotations

import re
from datetime import date

import pdfplumber

from models import (
    LoanMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

from parsers.utils import SPANISH_MONTHS

# --- Regex patterns ---

# "No del crédito: 590303630033352-4"
LOAN_NUMBER_RE = re.compile(r"No\s+del\s+crédito:\s*([\d-]+)")

# "Páguese antes del Feb. 10/2026"
PAYMENT_DUE_RE = re.compile(
    r"Páguese\s+antes\s+del\s+([A-Z][a-z]{2})\.\s+(\d{1,2})/(\d{4})"
)

# "Total Valor a Pagar $254,000.00"
TOTAL_PAYMENT_RE = re.compile(r"Total\s+Valor\s+a\s+Pagar\s*\$([\d,.]+)")

# "Saldo Anterior: Dic. 10/2025 $ 11,169,385.60"
PREV_BALANCE_RE = re.compile(r"Saldo\s+Anterior:\s+([A-Z][a-z]{2})\.\s+(\d{1,2})/(\d{4}).*\$\s*([\d,.]+)")

# "Saldo a: Ene. 10/2026 $ 11,161,141.11"
NEW_BALANCE_RE = re.compile(r"Saldo\s+a:\s+([A-Z][a-z]{2})\.\s+(\d{1,2})/(\d{4}).*\$\s*([\d,.]+)")

# "Tasa Interés Cte.Cobrada Periodo 1.05" (monthly rate; label and value on same line)
INTEREST_RATE_RE = re.compile(
    r"Tasa\s+Inter[eé]s\s+Cte\.?\s*Cobrada\s+Periodo\s+([\d,.]+)", re.IGNORECASE
)

# Transaction line on page 2
# "10Ene2026 $253,812.00 00277623 TRANSFERENCIA Z"
# Date format: DDMmmYYYY (Title case month)
TX_LINE_RE = re.compile(
    r"^(\d{1,2})([A-Z][a-z]{2})(\d{4})\s+"  # Date
    r"\$([\d,.]+)\s+"                       # Amount
    r"(\d+)\s+"                             # Auth/Ref
    r"(.+)"                                 # Description
)

def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    return float(s.replace(",", ""))

def _parse_date_mmm_dd_yyyy(m_str: str, d_str: str, y_str: str) -> date | None:
    """Parse Feb. 10/2026"""
    month = SPANISH_MONTHS.get(m_str.lower(), 0)
    if month == 0:
        return None
    return date(int(y_str), month, int(d_str))

def _parse_date_ddmmmyyyy(d_str: str, m_str: str, y_str: str) -> date | None:
    """Parse 10Ene2026"""
    month = SPANISH_MONTHS.get(m_str.lower(), 0)
    if month == 0:
        return None
    return date(int(y_str), month, int(d_str))

def parse_davivienda_loan(
    pdf_path: str, password: str | None = None
) -> ParsedStatement:
    """Parse Davivienda loan statement."""
    loan_number: str | None = None
    payment_due_date: date | None = None
    period_from: date | None = None
    period_to: date | None = None
    total_payment_due: float | None = None
    remaining_balance: float | None = None
    interest_rate: float | None = None
    
    transactions: list[ParsedTransaction] = []
    summary = StatementSummary()

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")

            for line in lines:
                stripped = line.strip()
                
                # Metadata
                if not loan_number:
                    m = LOAN_NUMBER_RE.search(stripped)
                    if m:
                        loan_number = m.group(1)

                if not payment_due_date:
                    m = PAYMENT_DUE_RE.search(stripped)
                    if m:
                        payment_due_date = _parse_date_mmm_dd_yyyy(m.group(1), m.group(2), m.group(3))

                if not total_payment_due:
                    m = TOTAL_PAYMENT_RE.search(stripped)
                    if m:
                        total_payment_due = _parse_us_number(m.group(1))

                if not interest_rate:
                    m = INTEREST_RATE_RE.search(stripped)
                    if m:
                        interest_rate = _parse_us_number(m.group(1))

                # Summary
                if not summary.previous_balance:
                    m = PREV_BALANCE_RE.search(stripped)
                    if m:
                        period_from = _parse_date_mmm_dd_yyyy(m.group(1), m.group(2), m.group(3))
                        summary.previous_balance = _parse_us_number(m.group(4))

                m_bal = NEW_BALANCE_RE.search(stripped)
                if m_bal and not remaining_balance:
                    period_to = _parse_date_mmm_dd_yyyy(m_bal.group(1), m_bal.group(2), m_bal.group(3))
                    remaining_balance = _parse_us_number(m_bal.group(4))

                # Transactions
                m_tx = TX_LINE_RE.match(stripped)
                if m_tx:
                    d_str, m_str, y_str = m_tx.group(1), m_tx.group(2), m_tx.group(3)
                    amount_str = m_tx.group(4)
                    ref = m_tx.group(5)
                    desc = m_tx.group(6).strip()
                    
                    tx_date = _parse_date_ddmmmyyyy(d_str, m_str, y_str)
                    if tx_date:
                        amount = _parse_us_number(amount_str)
                        # All transactions here seem to be payments (INFLOW) since it's a loan payment history
                        # Description "TRANSFERENCIA Z" implies payment.
                        transactions.append(
                            ParsedTransaction(
                                date=tx_date,
                                description=desc,
                                amount=amount,
                                direction=TransactionDirection.INFLOW, # Loans: payments reduce balance
                                authorization_number=ref,
                                currency="COP",
                            )
                        )

    # Note: Davivienda loan PDFs are often encrypted or image-based, but extractable text exists in sample.
    
    summary.final_balance = remaining_balance
    
    metadata = LoanMetadata(
        loan_number=loan_number,
        loan_type="CRÉDITO",
        remaining_balance=remaining_balance,
        interest_rate=interest_rate,
        total_payment_due=total_payment_due,
        payment_due_date=payment_due_date,
    )

    return ParsedStatement(
        bank="davivienda",
        statement_type=StatementType.LOAN,
        account_number=loan_number,
        period_from=period_from, 
        period_to=period_to if period_to else payment_due_date, # Approximation fallback
        currency="COP",
        summary=summary,
        loan_metadata=metadata,
        transactions=transactions,
    )
