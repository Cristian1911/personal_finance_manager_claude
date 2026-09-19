"""Bancolombia Fiducuenta (investment fund) PDF parser.

Parses Bancolombia Fiducuenta (Fondo de Inversión Colectiva) statements.
Number format: Colombian style (period = thousands, comma = decimal) e.g. 5.000.000,00
Date format: YYYYMMDD (compact format in header), DD in movement lines with month/year inferred
"""

from __future__ import annotations

import re
from datetime import date

import pdfplumber

from models import (
    InvestmentMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

# --- Regex patterns ---

# Header metadata
ACCOUNT_NUMBER_RE = re.compile(r"Cuenta de Inversión:\s*(\d+)")
PERIOD_DESDE_HASTA_RE = re.compile(r"Desde:\s*(\d{8})\s+Hasta:\s*(\d{8})")
UNIT_VALUE_RE = re.compile(r"Valor Unidad al Final:\s*([\d.,]+)")
RETURN_RATE_RE = re.compile(r"Rentabilidad Periodo:\s*([\d.,]+)\s*%")
ANNUAL_FEE_RE = re.compile(r"SOBRE VALOR DE LA CARTERA\s+([\d.,]+)\s*%\s*ANUAL")

# Transaction line pattern: date (YYYYMMDD), description, then numbers
# E.g. "20260826 APERTURA 5.000.000,00 104,15170655 5.000.000,00"
# The description keeps its accents ("ADICIÓN"), so the class must include them.
TRANSACTION_RE = re.compile(
    r"^(\d{8})\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$"
)

# Summary section patterns - look for header lines
SALDO_ANTERIOR_HEADER_RE = re.compile(r"SALDO ANTERIOR")
ADICIONES_HEADER_RE = re.compile(r"ADICIONES")
RETIROS_HEADER_RE = re.compile(r"RETIROS")
REND_NETOS_HEADER_RE = re.compile(r"REND\.\s*NETOS")
RETENCIÓN_HEADER_RE = re.compile(r"RETENCIÓN")
NUEVO_SALDO_HEADER_RE = re.compile(r"NUEVO SALDO")

# Pattern to extract multiple Colombian numbers from a line
COLOMBIAN_NUMBERS_RE = re.compile(r"([\d.,]+)")


def _parse_colombian_number(s: str) -> float:
    """Parse Colombian-formatted number: 5.000.000,89 → 5000000.89"""
    if not s or s.strip() in ("", "-", "0,00"):
        return 0.0
    s = s.strip().replace("$", "").strip()
    # Remove periods (thousands separator) and replace comma with period (decimal)
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_date_yyyymmdd(s: str) -> date | None:
    """Parse YYYYMMDD format date."""
    if not s or len(s) != 8:
        return None
    try:
        year = int(s[0:4])
        month = int(s[4:6])
        day = int(s[6:8])
        return date(year, month, day)
    except (ValueError, IndexError):
        return None


def parse_fiducuenta(pdf_path: str, password: str | None = None) -> ParsedStatement:
    """Parse a Bancolombia Fiducuenta PDF statement."""
    transactions: list[ParsedTransaction] = []
    account_number: str | None = None
    period_from: date | None = None
    period_to: date | None = None
    fund_name: str | None = None
    unit_value_end: float | None = None
    return_rate: float | None = None
    annual_fee: float | None = None

    # Summary data
    previous_balance: float | None = None
    additions: float | None = None
    withdrawals: float | None = None
    net_returns: float | None = None
    withholding: float | None = None
    new_balance: float | None = None
    units_end: float | None = None

    with pdfplumber.open(pdf_path, password=password) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

        if not full_text:
            return ParsedStatement(
                statement_type=StatementType.INVESTMENT,
                currency="COP",
                transactions=[],
            )

        lines = full_text.split("\n")

        # First pass: extract metadata from header
        for i, line in enumerate(lines):
            # Extract account number
            if not account_number:
                m = ACCOUNT_NUMBER_RE.search(line)
                if m:
                    account_number = m.group(1)

            # Extract period
            if not period_from:
                m = PERIOD_DESDE_HASTA_RE.search(line)
                if m:
                    period_from = _parse_date_yyyymmdd(m.group(1))
                    period_to = _parse_date_yyyymmdd(m.group(2))

            # Extract unit value
            if not unit_value_end:
                m = UNIT_VALUE_RE.search(line)
                if m:
                    unit_value_end = _parse_colombian_number(m.group(1))

            # Extract return rate
            if not return_rate:
                m = RETURN_RATE_RE.search(line)
                if m:
                    return_rate = _parse_colombian_number(m.group(1))

            # Extract annual fee
            if not annual_fee:
                m = ANNUAL_FEE_RE.search(line)
                if m:
                    annual_fee = _parse_colombian_number(m.group(1))

            # Set fund name if we see "FIDUCUENTA"
            if not fund_name and "FIDUCUENTA" in line.upper():
                fund_name = "FIDUCUENTA"

        # Second pass: extract transactions and summary
        in_transactions_section = False
        for i, line in enumerate(lines):
            stripped = line.strip()

            # Detect transaction section start
            if "MOVIMIENTOS" in stripped and "SALDO" in stripped:
                in_transactions_section = True
                continue

            # Stop at summary section
            if "SALDO ANTERIOR" in stripped and "VALOR EN PESOS" in stripped:
                in_transactions_section = False

            # Try to parse transaction line if in transaction section
            if in_transactions_section:
                m = TRANSACTION_RE.match(stripped)
                if m:
                    date_str = m.group(1)
                    description = m.group(2).strip()
                    valor = _parse_colombian_number(m.group(3))
                    # units = _parse_colombian_number(m.group(4))  # unused but present
                    balance = _parse_colombian_number(m.group(5))

                    tx_date = _parse_date_yyyymmdd(date_str)
                    if tx_date:
                        # Determine direction: APERTURA, ADICIÓN, ADICIONES, CONSIGNACION are INFLOW
                        # RETIRO, CANCELACION are OUTFLOW
                        desc_upper = description.upper()
                        if any(
                            x in desc_upper
                            for x in [
                                "APERTURA",
                                "ADICIÓN",
                                "ADICIONES",
                                "CONSIGNACION",
                            ]
                        ):
                            direction = TransactionDirection.INFLOW
                        elif any(
                            x in desc_upper for x in ["RETIRO", "CANCELACION"]
                        ):
                            direction = TransactionDirection.OUTFLOW
                        else:
                            # Default: positive amount = INFLOW, negative = OUTFLOW
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
                                balance=balance,
                                currency="COP",
                            )
                        )

            # Extract summary data - look for header row followed by data row
            # Format:
            # SALDO ANTERIOR ADICIONES RETIROS
            # VALOR EN PESOS VALOR EN UNIDADES VALOR EN PESOS VALOR EN PESOS
            # 0,00 0,00000000 5.000.000,00 0,00
            if (
                "SALDO ANTERIOR" in stripped
                and "ADICIONES" in stripped
                and "RETIROS" in stripped
            ):
                # Next line should have "VALOR EN PESOS"
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if "VALOR EN PESOS" in next_line:
                        # Line after that has the values
                        if i + 2 < len(lines):
                            value_line = lines[i + 2].strip()
                            # Extract numbers in order
                            numbers = [
                                _parse_colombian_number(m.group(1))
                                for m in COLOMBIAN_NUMBERS_RE.finditer(value_line)
                            ]
                            if len(numbers) >= 4:
                                previous_balance = numbers[0]
                                # numbers[1] is the units for adiciones
                                additions = numbers[2]
                                withdrawals = numbers[3]

            # REND. NETOS and RETENCIÓN and NUEVO SALDO are in similar format
            if (
                "REND." in stripped
                and "NETOS" in stripped
                and "RETENCIÓN" in stripped
                and "NUEVO SALDO" in stripped
            ):
                # Next line should have "VALOR EN PESOS"
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if "VALOR EN PESOS" in next_line or "VALOR EN UNIDADES" in next_line:
                        # Line after that has the values
                        if i + 2 < len(lines):
                            value_line = lines[i + 2].strip()
                            # Extract numbers in order
                            numbers = [
                                _parse_colombian_number(m.group(1))
                                for m in COLOMBIAN_NUMBERS_RE.finditer(value_line)
                            ]
                            if len(numbers) >= 4:
                                net_returns = numbers[0]
                                withholding = numbers[1]
                                new_balance = numbers[2]
                                units_end = numbers[3]

        # Create synthetic transactions for returns and withholding
        if period_to:
            if net_returns and net_returns > 0:
                transactions.append(
                    ParsedTransaction(
                        date=period_to,
                        description="RENDIMIENTOS NETOS",
                        amount=net_returns,
                        direction=TransactionDirection.INFLOW,
                        balance=None,
                        currency="COP",
                    )
                )

            if withholding and withholding > 0:
                transactions.append(
                    ParsedTransaction(
                        date=period_to,
                        description="RETENCIÓN EN LA FUENTE",
                        amount=withholding,
                        direction=TransactionDirection.OUTFLOW,
                        balance=None,
                        currency="COP",
                    )
                )

    return ParsedStatement(
        statement_type=StatementType.INVESTMENT,
        account_number=account_number,
        period_from=period_from,
        period_to=period_to,
        currency="COP",
        summary=StatementSummary(
            previous_balance=previous_balance,
            total_credits=additions,
            total_debits=withdrawals,
            final_balance=new_balance,
        ),
        investment_metadata=InvestmentMetadata(
            fund_name=fund_name,
            investment_account_number=account_number,
            unit_value_end=unit_value_end,
            period_return_pct=return_rate,
            fee_pct_annual=annual_fee,
            previous_balance=previous_balance,
            additions=additions,
            withdrawals=withdrawals,
            net_returns=net_returns,
            withholding=withholding,
            new_balance=new_balance,
            units_end=units_end,
        ),
        transactions=transactions,
    )
