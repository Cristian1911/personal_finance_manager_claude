from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel


class StatementType(str, Enum):
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"


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
    installments: str | None = None  # e.g. "1/24"


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
    interest_rate: float | None = None  # monthly rate as reported by bank
    late_interest_rate: float | None = None  # monthly mora rate
    total_payment_due: float | None = None
    minimum_payment: float | None = None
    payment_due_date: date | None = None


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
    transactions: list[ParsedTransaction]
