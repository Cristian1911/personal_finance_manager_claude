"""Bancolombia Loan (Crédito) PDF parser.

Parses digital Bancolombia loan statements including personal credit lines,
libranza loans, consumer credit, and calamity loans.
Number format: US style (comma = thousands, period = decimal) e.g. 1,234,567.89
Date format: MM/DD/YYYY
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

# Header metadata: "OBLIGACIÓN Nº: 8700081866"
LOAN_NUMBER_RE = re.compile(r"OBLIGACIÓN\s+Nº:\s*(\d+)")

# Date of payment: "FECHA DE PAGO: 2/16/2026"
PAYMENT_DUE_DATE_RE = re.compile(r"FECHA DE PAGO:\s*(\d{1,2})/(\d{1,2})/(\d{4})")

# Loan type line: "LÍNEA DE CRÉDITO PERSONAL TASA FIJA S.DESEMPLEO"
LOAN_TYPE_RE = re.compile(r"^LÍNEA DE CRÉDITO\s+(.+?)(?:\s+TASA|$)", re.IGNORECASE)

# Date fields in metadata: "FECHA DE DESEMBOLSO 10/16/2024"
DISBURSEMENT_DATE_RE = re.compile(r"FECHA DE DESEMBOLSO\s+(\d{1,2})/(\d{1,2})/(\d{4})")
STATEMENT_CUT_DATE_RE = re.compile(r"FECHA CORTE EXTRACTO\s+(\d{1,2})/(\d{1,2})/(\d{4})")
LAST_PAYMENT_DATE_RE = re.compile(r"FECHA ÚLTIMO PAGO\s+(\d{1,2})/(\d{1,2})/(\d{4})")

# Concept table lines - extract from left column
# Format: "ABONO A CAPITAL" followed by two numbers on same or subsequent lines
# Patterns for key rows in the concept table
ABONO_CAPITAL_RE = re.compile(r"ABONO A CAPITAL\s+([\d,.]+)\s+([\d,.]+)")
INTERES_CORRIENTE_RE = re.compile(r"INTERÉS CORRIENTE\s+([\d,.]+)\s+([\d,.]+)")
SEGURO_VIDA_RE = re.compile(r"SEGURO VIDA\s+([\d,.]+)\s+([\d,.]+)")
OTROS_CONCEPTOS_RE = re.compile(r"OTROS CONCEPTOS\s+([\d,.]+)\s+([\d,.]+)")
COMISION_RE = re.compile(r"COMISIÓN FNG/FAG\s+([\d,.]+)\s+([\d,.]+)")
IVA_RE = re.compile(r"IVA FNG/FAG\s+([\d,.]+)\s+([\d,.]+)")
TOTAL_RE = re.compile(r"TOTAL\s+([\d,.]+)\s+([\d,.]+)")

# Metadata lines from "INFORMACIÓN DEL CRÉDITO" section
VALOR_INICIAL_RE = re.compile(r"VALOR INICIAL\s+([\d,.]+)")
SALDO_CAPITAL_RE = re.compile(r"SALDO DE CAPITAL\s+([\d,.]+)")
SALDO_CREDITO_RE = re.compile(r"SALDO DE CRÉDITO\s+([\d,.]+)")
SALDO_CREDITO_ONLY_RE = re.compile(r"^SALDO DE CRÉDITO\s*$")
TASA_INTERES_RE = re.compile(r"TASA DE INTERÉS E\.A\.\s+([\d.,]+)")
TASA_MORA_RE = re.compile(r"TASA MORA A LA FECHA\s+([\d.,]+)")
CUOTA_NUMERO_RE = re.compile(r"CUOTA NÚMERO\s+(\d+)")
CUOTAS_MORA_RE = re.compile(r"Nº DE CUOTAS EN MORA\s+(\d+)")
SALDO_MORA_RE = re.compile(r"SALDO EN MORA CAPITAL\s+([\d,.]+)")


def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "").replace("%", "")
    if not s or s == "-" or s == ".00":
        return 0.0
    return float(s.replace(",", ""))


def parse_loan(pdf_path: str, password: str | None = None) -> ParsedStatement:
    """Parse a Bancolombia loan PDF statement.

    Loan statements typically do not contain transaction details, only
    summary metadata about the loan and payment due. Returns a single
    ParsedStatement with loan_metadata populated.
    """
    loan_number: str | None = None
    loan_type: str | None = None
    payment_due_date: date | None = None
    disbursement_date: date | None = None
    statement_cut_date: date | None = None
    last_payment_date: date | None = None

    initial_amount: float | None = None
    remaining_balance: float | None = None
    interest_rate: float | None = None
    late_interest_rate: float | None = None
    total_payment_due: float | None = None
    cuotas_in_mora: int = 0

    transactions: list[ParsedTransaction] = []

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            lines = text.split("\n")
            for i, line in enumerate(lines):
                stripped = line.strip()

                # --- Extract basic metadata ---
                if not loan_number:
                    m = LOAN_NUMBER_RE.search(stripped)
                    if m:
                        loan_number = m.group(1)

                if not payment_due_date:
                    m = PAYMENT_DUE_DATE_RE.search(stripped)
                    if m:
                        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
                        payment_due_date = date(year, month, day)

                if not loan_type:
                    m = LOAN_TYPE_RE.search(stripped)
                    if m:
                        loan_type = f"LÍNEA DE CRÉDITO {m.group(1).strip()}"

                # --- Extract dates from metadata sections ---
                if not disbursement_date:
                    m = DISBURSEMENT_DATE_RE.search(stripped)
                    if m:
                        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
                        disbursement_date = date(year, month, day)

                if not statement_cut_date:
                    m = STATEMENT_CUT_DATE_RE.search(stripped)
                    if m:
                        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
                        statement_cut_date = date(year, month, day)

                if not last_payment_date:
                    m = LAST_PAYMENT_DATE_RE.search(stripped)
                    if m:
                        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
                        try:
                            last_payment_date = date(year, month, day)
                        except ValueError:
                            pass

                # --- Extract amounts from concept table ---
                m = VALOR_INICIAL_RE.search(stripped)
                if m and not initial_amount:
                    initial_amount = _parse_us_number(m.group(1))

                m = SALDO_CREDITO_RE.search(stripped)
                if m and not remaining_balance:
                    remaining_balance = _parse_us_number(m.group(1))

                # Handle "SALDO DE CRÉDITO" on its own line, with value on next line
                if not remaining_balance and SALDO_CREDITO_ONLY_RE.match(stripped):
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        m = re.match(r"^([\d,.]+)", next_line)
                        if m:
                            remaining_balance = _parse_us_number(m.group(1))

                # For total payment due, look at "TOTAL" line (second number is what to pay)
                m = TOTAL_RE.search(stripped)
                if m and not total_payment_due:
                    total_payment_due = _parse_us_number(m.group(2))

                # --- Extract interest rates ---
                if not interest_rate:
                    m = TASA_INTERES_RE.search(stripped)
                    if m:
                        try:
                            interest_rate = float(m.group(1).replace(",", "."))
                        except ValueError:
                            pass

                if not late_interest_rate:
                    m = TASA_MORA_RE.search(stripped)
                    if m:
                        try:
                            rate_str = m.group(1).strip()
                            if rate_str and rate_str != ".00":
                                late_interest_rate = float(rate_str.replace(",", "."))
                        except ValueError:
                            pass

                # --- Extract payment status ---
                m = CUOTAS_MORA_RE.search(stripped)
                if m:
                    try:
                        cuotas_in_mora = int(m.group(1))
                    except ValueError:
                        pass

    # Set period_from to statement_cut_date - 30 days (approximate), period_to to cut date
    period_to = statement_cut_date
    period_from = None
    if period_to:
        try:
            from datetime import timedelta
            period_from = period_to - timedelta(days=30)
        except Exception:
            period_from = period_to

    return ParsedStatement(
        statement_type=StatementType.LOAN,
        account_number=loan_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=StatementSummary(
            final_balance=remaining_balance,
        ),
        loan_metadata=LoanMetadata(
            loan_number=loan_number,
            loan_type=loan_type,
            initial_amount=initial_amount,
            disbursement_date=disbursement_date,
            remaining_balance=remaining_balance,
            interest_rate=interest_rate,
            late_interest_rate=late_interest_rate,
            total_payment_due=total_payment_due,
            payment_due_date=payment_due_date,
            installments_in_default=cuotas_in_mora if cuotas_in_mora > 0 else None,
            statement_cut_date=statement_cut_date,
            last_payment_date=last_payment_date,
        ),
        transactions=transactions,
    )
