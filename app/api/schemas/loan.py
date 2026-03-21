from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class LoanCreate(BaseModel):
    name: str
    bank: str | None = None
    original_amount: Decimal
    remaining_amount: Decimal
    interest_rate: Decimal
    monthly_payment: Decimal
    next_payment_date: date
    start_date: date
    payment_type: str = "annuity"


class LoanUpdate(BaseModel):
    name: str | None = None
    bank: str | None = None
    interest_rate: Decimal | None = None
    monthly_payment: Decimal | None = None
    next_payment_date: date | None = None


class LoanPaymentBody(BaseModel):
    amount: Decimal = Field(gt=0)
    paid_at: datetime | None = None


class LoanOut(BaseModel):
    id: int
    name: str
    bank: str | None
    original_amount: Decimal
    remaining_amount: Decimal
    interest_rate: Decimal
    monthly_payment: Decimal
    next_payment_date: date
    start_date: date
    is_active: bool

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
    savings_with_avalanche: float  # interest savings vs snowball
