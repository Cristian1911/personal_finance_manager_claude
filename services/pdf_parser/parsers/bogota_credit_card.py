"""Banco de Bogotá Tarjeta de Crédito (credit card) PDF parser.

Parses Banco de Bogotá credit card statements.
Number format: US style (comma = thousands, period = decimal) e.g. 2,650,000.00
Date format in table: DD/MM/YYYY
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

# --- Regex patterns ---

# Card number: "Nro. 2026021402TC6005474485" (this looks like a statement number)
# Actual card number usually hidden or at bottom.
# In sample: "Tarjeta Número 4506680027781509" at bottom of page 1
CARD_NUMBER_RE = re.compile(r"Tarjeta\s+Número\s+(\d+)")

# Dates in header:
# "Fecha Facturación Fecha Límite de Pago"
# "15/02/2026 09/03/2026"
HEADER_DATES_RE = re.compile(r"(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})")

# Summary section patterns
# "Cupo Total" and "Cupo Disponible" are column headers; values appear on the
# "COMPRAS <cupo_total> <cupo_disponible> <utilizaciones>" row below them.
CUPO_COMPRAS_RE = re.compile(r"^COMPRAS\s+([\d,.]+)\s+([\d,.]+)")
PAGO_MINIMO_RE = re.compile(r"Pago\s+Minimo\s*([\d,.]+)")
PAGO_TOTAL_RE = re.compile(r"Pago\s+Total\s*([\d,.]+)")

# Summary table items
SALDO_ANTERIOR_RE = re.compile(r"Saldo\s+Anterior\s*([\d,.]+)")
COMPRAS_RE = re.compile(r"\+\s*Compras\s*([\d,.]+)")
INTERESES_RE = re.compile(r"\+\s*Intereses\s+Corrientes\s*\(?2\)?\s*([\d,.]+)")

# Transaction lines:
# 20032659 AVANCE CAJERO ATH 30/05/2025 30/05/2025 36 50,000 25.939 1,350 28 37,773
# Structure: Auth | Desc | Date | Date | Term | OrigVal | Rate | ? | Rem | Balance
# Note: Description can have spaces. Dates are fixed format.
# We can try to match the two dates and the numbers at the end.
# Group 1: Auth
# Group 2: Desc
# Group 3: Date 1
# Group 4: Date 2
# Group 5: Term (digits)
# Group 6: Original Value (number)
# Group 7: Rate (number)
# Group 8: Monthly Payment? (number)
# Group 9: Remaining Inst (digits)
# Group 10: Balance (number)
TX_LINE_RE = re.compile(
    r"^(\d+)\s+"  # Auth
    r"(.+?)\s+"   # Description (lazy)
    r"(\d{2}/\d{2}/\d{4})\s+"  # Date 1
    r"(\d{2}/\d{2}/\d{4})\s+"  # Date 2
    r"(\d+)\s+"   # Term
    r"([\d,.]+)\s+"  # Original Value
    r"([\d,.]+)\s+"  # Rate
    r"([\d,.]+)\s+"  # Payment?
    r"(\d+)\s+"   # Remaining
    r"([\d,.]+)"     # Balance
)

# Simple payment/fee lines might be different, e.g.:
# 06005255 PAGO T.CREDITO POR CANAL DIGITAL 05/02/2026 05/02/2026 00 103,834 0.000 0 00 0
TX_SIMPLE_RE = re.compile(
    r"^(\d+)\s+"  # Auth
    r"(.+?)\s+"   # Description
    r"(\d{2}/\d{2}/\d{4})\s+"  # Date 1
    r"(\d{2}/\d{2}/\d{4})\s+"  # Date 2
    r"(\d+)\s+"   # Term
    r"([\d,.]+)\s+"  # Value
    r"([\d,.]+)\s+"  # Rate
    r"([\d,.]+)\s+"  # Value 2
    r"(\d+)\s+"   # Value 3
    r"([\d,.]+)"     # Value 4
)

# Rate can be found in the transaction line itself (25.939)

def _parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    s = s.strip().replace("$", "").replace(" ", "")
    if not s or s == "-":
        return 0.0
    return float(s.replace(",", ""))


def parse_bogota_credit_card(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement]:
    """Parse Banco de Bogotá credit card statement."""
    transactions: list[ParsedTransaction] = []
    period_from: date | None = None
    period_to: date | None = None
    card_last_four: str | None = None
    summary = StatementSummary()
    metadata = CreditCardMetadata()

    # Temporary storage for summary fields
    total_payment = None
    min_payment = None
    credit_limit = None
    available_credit = None

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

                if not period_to:
                    # Look for "Fecha Facturación Fecha Límite de Pago" pattern context
                    # But regex can find the dates directly if they are on a line looks like dates
                    # In sample: "15/02/2026 09/03/2026"
                    m = HEADER_DATES_RE.search(stripped)
                    if m:
                        # First date is Billing Date (End of period), Second is Due Date
                        # Period from is likely Billing Date - 30 days roughly, or we just leave None
                        try:
                            d1 = m.group(1).split("/")
                            period_to = date(int(d1[2]), int(d1[1]), int(d1[0]))
                            
                            d2 = m.group(2).split("/")
                            metadata.payment_due_date = date(int(d2[2]), int(d2[1]), int(d2[0]))
                        except ValueError:
                            pass

                # --- Summary ---
                # Values live on the "COMPRAS <cupo_total> <cupo_disponible> ..." row
                if not credit_limit:
                    m = CUPO_COMPRAS_RE.match(stripped)
                    if m:
                        credit_limit = _parse_us_number(m.group(1))
                        if not available_credit:
                            available_credit = _parse_us_number(m.group(2))

                if not min_payment:
                    # This often appears as "= Pago Minimo 104,000" in sample
                    if "Pago Minimo" in stripped:
                         m = re.search(r"Pago\s+Minimo\s*([\d,.]+)", stripped)
                         if m:
                             min_payment = _parse_us_number(m.group(1))

                if not total_payment:
                    if "Pago Total" in stripped:
                        m = re.search(r"Pago\s+Total\s*([\d,.]+)", stripped)
                        if m:
                            total_payment = _parse_us_number(m.group(1))

                # Statement summary lines
                if not summary.previous_balance:
                    m = SALDO_ANTERIOR_RE.search(stripped)
                    if m:
                        summary.previous_balance = _parse_us_number(m.group(1))

                if "Pagos y Créditos" in stripped:
                     # e.g. "- Pagos y Créditos 103,834"
                     m = re.search(r"Pagos\s+y\s+Créditos\s*([\d,.]+)", stripped)
                     if m:
                         summary.total_credits = _parse_us_number(m.group(1))

                # Note: "Compras" matches both top summary and bottom details
                # We prioritize logic where we can find it clearly

                # --- Transactions ---
                # Strategy: Look for two dates in the line, which marks the middle of a transaction row
                # "20032659 ... 30/05/2025 30/05/2025 ... 37,773"
                
                # Regex to find the two dates
                date_match = re.search(r"(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})", stripped)
                if date_match:
                    # Check if line starts with digits (Auth number) to confirm it is a transaction
                    # and not just the header line "Fecha Facturación Fecha Límite..."
                    if not re.match(r"^\d+", stripped):
                        continue

                    start_idx = date_match.start()
                    end_idx = date_match.end()
                    
                    # Left part: "20032659 AVANCE CAJERO ATH "
                    left_part = stripped[:start_idx].strip()
                    # Right part: " 36 50,000 25.939 1,350 28 37,773"
                    right_part = stripped[end_idx:].strip()
                    
                    # Parse Left
                    parts_left = left_part.split(maxsplit=1)
                    if len(parts_left) < 2:
                        continue
                    auth = parts_left[0]
                    desc = parts_left[1]
                    
                    # dates
                    date_str = date_match.group(1)
                    
                    # Parse Right
                    # Expecting: Term, OrigVal, Rate, MonthlyPay, RemTerm, Balance
                    # But "PAGO" lines might have different fields?
                    # "00 103,834 0.000 0 00 0" -> 6 fields.
                    # "36 50,000 25.939 1,350 28 37,773" -> 6 fields.
                    # Seems consistent number of fields (6).
                    
                    nums = right_part.split()
                    if len(nums) < 6:
                        continue
                        
                    # Map fields
                    term_str = nums[0]
                    amount_str = nums[1]
                    # rate_str = nums[2]
                    # pay_str = nums[3]
                    rem_str = nums[4]
                    balance_str = nums[5]

                    try:
                        d_parts = date_str.split("/")
                        tx_date = date(int(d_parts[2]), int(d_parts[1]), int(d_parts[0]))
                        
                        amount = _parse_us_number(amount_str)
                        balance = _parse_us_number(balance_str)
                        
                        direction = TransactionDirection.OUTFLOW
                        upper_desc = desc.upper()
                        if upper_desc.startswith("PAGO") or upper_desc.startswith("ABONO"):
                            direction = TransactionDirection.INFLOW
                        
                        installments = None
                        if term_str != "00" and rem_str != "00":
                            installments = f"{rem_str}/{term_str} left"

                        transactions.append(
                            ParsedTransaction(
                                date=tx_date,
                                description=desc,
                                amount=amount,
                                direction=direction,
                                balance=balance,
                                authorization_number=auth,
                                installments=installments,
                                currency="COP",
                            )
                        )

                    except ValueError:
                        continue

    # Fill metadata
    metadata.credit_limit = credit_limit
    metadata.available_credit = available_credit
    metadata.minimum_payment = min_payment
    metadata.total_payment_due = total_payment
    
    # Fill summary
    summary.final_balance = total_payment # Usually total payment due is the balance for CC

    return [
        ParsedStatement(
            bank="banco_de_bogota",
            statement_type=StatementType.CREDIT_CARD,
            card_last_four=card_last_four,
            period_from=period_from,  # We only found end date
            period_to=period_to,
            currency="COP",
            summary=summary,
            credit_card_metadata=metadata,
            transactions=transactions,
        )
    ]
