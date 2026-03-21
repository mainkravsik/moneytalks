from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class LoanCreate(BaseModel):
    loan_type: str = "loan"  # loan | card
    name: str
    bank: str | None = None
    # loan fields
    original_amount: Decimal | None = None
    remaining_amount: Decimal
    interest_rate: Decimal
    monthly_payment: Decimal
    next_payment_date: date
    start_date: date | None = None
    payment_type: str = "annuity"
    # card-only fields
    credit_limit: Decimal | None = None
    grace_days: int | None = None
    min_payment: Decimal | None = None


class LoanUpdate(BaseModel):
    name: str | None = None
    bank: str | None = None
    interest_rate: Decimal | None = None
    monthly_payment: Decimal | None = None
    next_payment_date: date | None = None
    credit_limit: Decimal | None = None
    grace_days: int | None = None
    min_payment: Decimal | None = None
    remaining_amount: Decimal | None = None


class LoanPaymentBody(BaseModel):
    amount: Decimal = Field(gt=0)
    paid_at: datetime | None = None


class LoanOut(BaseModel):
    id: int
    loan_type: str
    name: str
    bank: str | None
    original_amount: Decimal | None
    remaining_amount: Decimal
    interest_rate: Decimal
    monthly_payment: Decimal
    next_payment_date: date
    start_date: date | None
    is_active: bool
    credit_limit: Decimal | None
    grace_days: int | None
    min_payment: Decimal | None

    model_config = {"from_attributes": True}


class StrategyResult(BaseModel):
    strategy: str
    months_to_payoff: int
    total_interest: float
    total_paid: float
    extra: float


class PayoffResponse(BaseModel):
    snowball: StrategyResult
    avalanche: StrategyResult
    savings_with_avalanche: float
