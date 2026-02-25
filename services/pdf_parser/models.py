from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel


class StatementType(str, Enum):
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"
    LOAN = "loan"


class TransactionDirection(str, Enum):
    INFLOW = "INFLOW"
    OUTFLOW = "OUTFLOW"


class ParsedTransaction(BaseModel):
    date: date
    description: str
    amount: float  # always positive
    direction: TransactionDirection
    balance: float | None = None
    currency: str = "COP"
    authorization_number: str | None = None
    installment_current: int | None = None  # e.g. 3 (cuota 3 of 24)
    installment_total: int | None = None    # e.g. 24


class StatementSummary(BaseModel):
    previous_balance: float | None = None
    total_credits: float | None = None
    total_debits: float | None = None
    final_balance: float | None = None
    purchases_and_charges: float | None = None
    interest_charged: float | None = None


class CreditCardMetadata(BaseModel):
    credit_limit: float | None = None
    available_credit: float | None = None
    interest_rate: float | None = None  # annual effective rate (EA)
    late_interest_rate: float | None = None  # annual mora rate (EA) when available
    total_payment_due: float | None = None
    minimum_payment: float | None = None
    payment_due_date: date | None = None


class LoanMetadata(BaseModel):
    loan_number: str | None = None
    loan_type: str | None = None  # e.g. "LÍNEA DE CRÉDITO PERSONAL TASA FIJA"
    initial_amount: float | None = None  # value at disbursement
    disbursement_date: date | None = None
    remaining_balance: float | None = None  # remaining principal
    interest_rate: float | None = None  # annual rate (EA)
    late_interest_rate: float | None = None  # mora rate
    total_payment_due: float | None = None  # total payment this period
    minimum_payment: float | None = None  # minimum payment amount
    payment_due_date: date | None = None  # payment deadline
    installments_in_default: int | None = None  # number of missed payments
    statement_cut_date: date | None = None  # period end date
    last_payment_date: date | None = None  # last payment made


class ParsedStatement(BaseModel):
    bank: str = "bancolombia"
    statement_type: StatementType
    account_number: str | None = None
    card_last_four: str | None = None
    period_from: date | None = None
    period_to: date | None = None
    currency: str = "COP"
    summary: StatementSummary | None = None
    credit_card_metadata: CreditCardMetadata | None = None
    loan_metadata: LoanMetadata | None = None
    transactions: list[ParsedTransaction]
