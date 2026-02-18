"""Lulo Bank Crédito de Consumo (consumer loan) PDF parser.

Parses Lulo Bank consumer loan statements including payment history,
loan metadata, and next payment details.
Number format: US style (comma = thousands, period = decimal) e.g. 1,234,567.89
Date format: DD de mes YYYY and MMM. DD, YYYY
"""

from __future__ import annotations

import re
from datetime import date, timedelta

import pdfplumber

from models import (
    LoanMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementType,
    TransactionDirection,
)
from parsers.utils import SPANISH_MONTHS, parse_us_number

# --- Regex patterns ---

# Header line with loan info: "39772331964 5 de 36 Febrero 06 - 2026"
# Loan number is first, followed by installment info and cut date
LOAN_NUMBER_RE = re.compile(r"^(\d{11,})\s+(\d+)\s+de\s+(\d+)\s+(\w+)\s+(\d{1,2})\s*-\s*(\d{4})")

# Payment due date: "Límite de pago: Feb. 16, 2026" (note: Límite has accent)
PAYMENT_DUE_DATE_RE = re.compile(r"Límite de pago:\s+(\w+)\.\s+(\d{1,2}),\s+(\d{4})")

# "Saldo total a la fecha" section amounts with optional $
SALDO_TOTAL_RE = re.compile(r"Saldo total a la fecha\s+\$?\s*([\d.,]+)")
MONTO_SOLICITADO_RE = re.compile(r"Monto solicitado\s+\$?\s*([\d.,]+)")

# Disbursement date: "Fecha de apertura 02 de septiembre de 2025"
DISBURSEMENT_DATE_RE = re.compile(
    r"Fecha de apertura\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})"
)

# Interest rate: "Tasa de interés efectiva anual 23.6%"
INTEREST_RATE_RE = re.compile(r"Tasa de interés efectiva anual\s+([\d.,]+)%?")

# Total payment due: "Valor a pagar cuota $339,272.27"
TOTAL_PAYMENT_DUE_RE = re.compile(r"Valor a pagar cuota\s+\$?\s*([\d.,]+)")


def _parse_spanish_date(s: str) -> date | None:
    """Parse Spanish date formats: 'DD mes YYYY' or 'MMM. DD, YYYY' or 'MMM.. DD, YYYY'"""
    s = s.strip()

    # Try "DD de mes de YYYY" format (e.g., "02 de septiembre de 2025")
    m = re.match(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", s)
    if m:
        try:
            day, month_str, year = int(m.group(1)), m.group(2).lower()[:3], int(m.group(3))
            month = SPANISH_MONTHS.get(month_str, 0)
            if month > 0:
                return date(year, month, day)
        except (ValueError, KeyError):
            pass

    # Try "MMM.. DD, YYYY" format with two dots (e.g., "ene.. 19, 2026")
    m = re.match(r"(\w+)\.\.\s+(\d{1,2}),\s+(\d{4})", s)
    if m:
        try:
            month_str, day, year = m.group(1).lower()[:3], int(m.group(2)), int(m.group(3))
            month = SPANISH_MONTHS.get(month_str, 0)
            if month > 0:
                return date(year, month, day)
        except (ValueError, KeyError):
            pass

    # Try "MMM. DD, YYYY" format with one dot (e.g., "Feb. 16, 2026")
    m = re.match(r"(\w+)\.\s+(\d{1,2}),\s+(\d{4})", s)
    if m:
        try:
            month_str, day, year = m.group(1).lower()[:3], int(m.group(2)), int(m.group(3))
            month = SPANISH_MONTHS.get(month_str, 0)
            if month > 0:
                return date(year, month, day)
        except (ValueError, KeyError):
            pass

    # Try simple numeric date format "DD/MM/YYYY" or "DD-MM-YYYY"
    m = re.match(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", s)
    if m:
        try:
            day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return date(year, month, day)
        except ValueError:
            pass

    return None


def parse_lulo_loan(pdf_path: str, password: str | None = None) -> ParsedStatement:
    """Parse a Lulo Bank consumer loan (Crédito de Consumo) PDF statement.

    Extracts loan metadata, payment history, and next payment details.
    """
    loan_number: str | None = None
    loan_type: str = "Crédito de Consumo"
    statement_cut_date: date | None = None
    payment_due_date: date | None = None
    disbursement_date: date | None = None

    initial_amount: float | None = None
    remaining_balance: float | None = None
    interest_rate: float | None = None
    total_payment_due: float | None = None

    transactions: list[ParsedTransaction] = []
    in_payment_table = False

    with pdfplumber.open(pdf_path, password=password) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"

        lines = full_text.split("\n")

        for i, line in enumerate(lines):
            stripped = line.strip()

            # --- Extract loan number and cut date from header line ---
            if not loan_number:
                m = LOAN_NUMBER_RE.match(stripped)
                if m:
                    loan_number = m.group(1)
                    # Also extract cut date from same line: "Febrero 06 - 2026"
                    month_str = m.group(4).lower()[:3]
                    day = int(m.group(5))
                    year = int(m.group(6))
                    month = SPANISH_MONTHS.get(month_str, 0)
                    if month > 0:
                        try:
                            statement_cut_date = date(year, month, day)
                        except ValueError:
                            pass

            # --- Extract payment due date ---
            if not payment_due_date:
                m = PAYMENT_DUE_DATE_RE.search(stripped)
                if m:
                    day, year = int(m.group(2)), int(m.group(3))
                    month_str = m.group(1).lower()[:3]
                    month = SPANISH_MONTHS.get(month_str, 0)
                    if month > 0:
                        try:
                            payment_due_date = date(year, month, day)
                        except ValueError:
                            pass

            # --- Extract disbursement date ---
            if not disbursement_date:
                m = DISBURSEMENT_DATE_RE.search(stripped)
                if m:
                    day, year = int(m.group(1)), int(m.group(3))
                    month_str = m.group(2).lower()[:3]
                    month = SPANISH_MONTHS.get(month_str, 0)
                    if month > 0:
                        try:
                            disbursement_date = date(year, month, day)
                        except ValueError:
                            pass

            # --- Extract balances and amounts ---
            m = SALDO_TOTAL_RE.search(stripped)
            if m and not remaining_balance:
                try:
                    remaining_balance = parse_us_number(m.group(1))
                except (ValueError, AttributeError):
                    pass

            m = MONTO_SOLICITADO_RE.search(stripped)
            if m and not initial_amount:
                try:
                    initial_amount = parse_us_number(m.group(1))
                except (ValueError, AttributeError):
                    pass

            # --- Extract interest rate ---
            if not interest_rate:
                m = INTEREST_RATE_RE.search(stripped)
                if m:
                    try:
                        interest_rate = float(m.group(1).replace(",", "."))
                    except ValueError:
                        pass

            # --- Extract total payment due ---
            if not total_payment_due:
                m = TOTAL_PAYMENT_DUE_RE.search(stripped)
                if m:
                    try:
                        total_payment_due = parse_us_number(m.group(1))
                    except (ValueError, AttributeError):
                        pass

            # --- Detect payment history section ---
            if "Mis pagos" in stripped:
                in_payment_table = True
                continue

            # --- Parse payment history rows ---
            # Skip header rows and explanatory text
            if in_payment_table and stripped and not any(
                x in stripped
                for x in [
                    "Fecha",
                    "Valor",
                    "Capital",
                    "Interés",
                    "Seguro",
                    "Si tu crédito",
                    "Hemos actualizado",
                    "La información",
                    "Los gastos",
                    "¿Tienes dudas?",
                    "*Si tu crédito",
                    "de cobranza",
                    "https://",
                ]
            ):
                # Try to parse a payment row: date | amount | capital | interest | ...
                # Example line: "ene.. 19, 2026 $339,414.44 $174,966.18 $149,395.76 $437.4 $14,615.1"
                # Pattern: month.. day, year followed by dollar amounts
                m = re.match(r"(\w+\.\.\s+\d{1,2},\s+\d{4})\s+\$?([\d.,]+)", stripped)

                if m:
                    date_str = m.group(1)
                    tx_date = _parse_spanish_date(date_str)

                    if tx_date:
                        # Extract the amount (Valor column)
                        amount_str = m.group(2)
                        try:
                            amount = parse_us_number(amount_str)
                            # Payment history entries are OUTFLOW (payments made)
                            transactions.append(
                                ParsedTransaction(
                                    date=tx_date,
                                    description=f"Pago cuota",
                                    amount=amount,
                                    direction=TransactionDirection.OUTFLOW,
                                    currency="COP",
                                )
                            )
                        except (ValueError, AttributeError):
                            pass

    # Set period dates: period_from is approximately 30 days before cut, period_to is cut date
    period_to = statement_cut_date
    period_from = None
    if period_to:
        try:
            period_from = period_to - timedelta(days=30)
        except Exception:
            period_from = period_to

    return ParsedStatement(
        bank="lulo",
        statement_type=StatementType.LOAN,
        account_number=loan_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        loan_metadata=LoanMetadata(
            loan_number=loan_number,
            loan_type=loan_type,
            initial_amount=initial_amount,
            disbursement_date=disbursement_date,
            remaining_balance=remaining_balance,
            interest_rate=interest_rate,
            total_payment_due=total_payment_due,
            payment_due_date=payment_due_date,
            statement_cut_date=statement_cut_date,
        ),
        transactions=transactions,
    )
