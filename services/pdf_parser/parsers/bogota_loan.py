"""Banco de Bogotá Crédito de Vivienda (Housing Loan) PDF parser.

Parses Banco de Bogotá housing loan statements.
Number format: US style (comma = thousands, period = decimal) e.g. 509,957.56
Date format for metadata: DD/MM/YYYY
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
)

# --- Regex patterns ---

# "NÚMERO DE CRÉDITO 00359673701"
LOAN_NUMBER_RE = re.compile(r"NÚMERO\s+DE\s+CRÉDITO\s*(\d+)")

# Header dates and amounts
# "FECHA LÍMITE DE PAGO FECHA DE CORTE VALOR TOTAL A PAGAR"
# "22/02/2026 07/02/2026 $509,957.56"
# We can regex for specific lines or just context.
PAYMENT_DUE_DATE_RE = re.compile(r"(\d{2}/\d{2}/\d{4})") # Generic date finder?
# Better: look for date near "FECHA LÍMITE DE PAGO"

# "VALOR TOTAL A PAGAR $509,957.56"
TOTAL_PAYMENT_RE = re.compile(r"VALOR\s+TOTAL\s+A\s+PAGAR\s*\$([\d,.]+)")

# "DATOS GENERALES DEL CRÉDITO" section
# "MONTO APROBADO 40,000,000.00"
INITIAL_AMOUNT_RE = re.compile(r"(?:MONTO|VALOR)\s+APROBADO\s+([\d,.]+)")

# "TASA PACTADA E.A. 13.09" — agreed annual rate
INTEREST_RATE_RE = re.compile(r"TASA\s+PACTADA\s+E\.A\.\s+([\d,.]+)")

# "TASA INTERÉS MORA E.A. 19.65" — late/default annual rate
LATE_RATE_RE = re.compile(r"TASA\s+INTER[EÉ]S\s+MORA\s+E\.A\.\s+([\d,.]+)")

# Summary table
# "+ CAPITAL 105,393.33"
# "+ INTERESES CORRIENTES 345,501.67"
SUMMARY_CAPITAL_RE = re.compile(r"\+\s*CAPITAL\s+([\d,.]+)")
SUMMARY_INTEREST_RE = re.compile(r"\+\s*INTERESES\s+CORRIENTES\s+([\d,.]+)")
SUMMARY_INSURANCE_RE = re.compile(r"\+\s*SEGURO\s+DE\s+VIDA\s+([\d,.]+)")

# "SALDO TOTAL A LA FECHA DE CORTE $36,125,565.99"
REMAINING_BALANCE_RE = re.compile(r"SALDO\s+TOTAL\s+A\s+LA\s+FECHA\s+DE\s+CORTE\s*\$([\d,.]+)")

def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    return float(s.replace(",", ""))

def parse_bogota_loan(
    pdf_path: str, password: str | None = None
) -> ParsedStatement:
    """Parse Banco de Bogotá loan statement."""
    loan_number: str | None = None
    loan_type: str = "CRÉDITO DE VIVIENDA" # Default inference
    payment_due_date: date | None = None
    statement_cut_date: date | None = None
    
    initial_amount: float | None = None
    remaining_balance: float | None = None
    interest_rate: float | None = None
    late_interest_rate: float | None = None
    total_payment_due: float | None = None
    
    capital_payment = 0.0
    interest_payment = 0.0

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.split("\n")
            for i, line in enumerate(lines):
                stripped = line.strip()
                
                if not loan_number:
                    m = LOAN_NUMBER_RE.search(stripped)
                    if m:
                        loan_number = m.group(1)

                if "FECHA LÍMITE DE PAGO" in stripped and "FECHA DE CORTE" in stripped:
                    # Next line usually has the values: "Entrega: EM Oficina: ... 22/02/2026 07/02/2026 $509,957.56"
                    if i + 1 < len(lines):
                        next_line = lines[i+1].strip()
                        
                        # Find all dates in the line
                        date_matches = re.findall(r"(\d{2}/\d{2}/\d{4})", next_line)
                        if len(date_matches) >= 2:
                             try:
                                 # Assuming first is Payment Due, Second is Cut Date based on column headers
                                 d1 = date_matches[0].split("/") # Due Date
                                 payment_due_date = date(int(d1[2]), int(d1[1]), int(d1[0]))
                                 
                                 d2 = date_matches[1].split("/") # Cut Date
                                 statement_cut_date = date(int(d2[2]), int(d2[1]), int(d2[0]))
                             except ValueError:
                                 pass
                                 
                        m_val = re.search(r"\$([\d,.]+)", next_line)
                        if m_val:
                            total_payment_due = _parse_us_number(m_val.group(1))

                if not initial_amount:
                    m = INITIAL_AMOUNT_RE.search(stripped)
                    if m:
                        initial_amount = _parse_us_number(m.group(1))

                if not interest_rate:
                    m = INTEREST_RATE_RE.search(stripped)
                    if m:
                        interest_rate = _parse_us_number(m.group(1))

                if not late_interest_rate:
                    m = LATE_RATE_RE.search(stripped)
                    if m:
                        late_interest_rate = _parse_us_number(m.group(1))

                m = REMAINING_BALANCE_RE.search(stripped)
                if m:
                    remaining_balance = _parse_us_number(m.group(1))

                m = SUMMARY_CAPITAL_RE.search(stripped)
                if m:
                    capital_payment = _parse_us_number(m.group(1))

                m = SUMMARY_INTEREST_RE.search(stripped)
                if m:
                    interest_payment = _parse_us_number(m.group(1))
    
    # Re-scan for initial amount if possible using context?
    # Or just start with what we have.

    summary = StatementSummary(
        final_balance=remaining_balance,
        purchases_and_charges=capital_payment,  # Principal portion of the period payment
        interest_charged=interest_payment,
    )
    
    metadata = LoanMetadata(
        loan_number=loan_number,
        loan_type=loan_type,
        initial_amount=initial_amount,
        remaining_balance=remaining_balance,
        interest_rate=interest_rate,
        late_interest_rate=late_interest_rate,
        total_payment_due=total_payment_due,
        payment_due_date=payment_due_date,
        statement_cut_date=statement_cut_date,
    )

    return ParsedStatement(
        bank="banco_de_bogota",
        statement_type=StatementType.LOAN,
        account_number=loan_number,
        period_from=None, # Only cut date known
        period_to=statement_cut_date,
        currency="COP",
        summary=summary,
        loan_metadata=metadata,
        transactions=[], # No transaction history in this statement
    )
