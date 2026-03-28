from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class CardChargeCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    description: str = Field(min_length=1, max_length=200)
    charge_type: str = Field(pattern="^(purchase|transfer|cash)$")
    charge_date: date


class CardChargeOut(BaseModel):
    id: int
    loan_id: int
    amount: Decimal
    description: str
    charge_type: str
    charge_date: date
    grace_deadline: date | None
    is_paid: bool
    status: str  # "in_grace" | "overdue" | "paid" | "no_grace"

    model_config = {"from_attributes": True}


class GraceBucket(BaseModel):
    deadline: date
    total: Decimal
    is_overdue: bool


class CardSummary(BaseModel):
    total_debt: Decimal
    grace_buckets: list[GraceBucket]
    non_grace_debt: Decimal
    accrued_interest: Decimal
    min_payment: Decimal
    available: Decimal


class CardPayoffMonth(BaseModel):
    month: str
    debt_start: float
    payment: float
    interest: float
    debt_end: float


class CardPayoffResponse(BaseModel):
    months: list[CardPayoffMonth]
    total_months: int
    total_interest: float
    total_paid: float
    recommendations: dict[str, float]
