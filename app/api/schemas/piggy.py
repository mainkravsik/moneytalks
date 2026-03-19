from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class PiggyCreate(BaseModel):
    name: str
    target_amount: Decimal | None = None
    target_date: date | None = None


class PiggyUpdate(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = None
    target_date: date | None = None


class ContributeBody(BaseModel):
    amount: Decimal = Field(gt=0)


class PiggyOut(BaseModel):
    id: int
    name: str
    target_amount: Decimal | None
    current_amount: Decimal
    target_date: date | None
    is_active: bool

    model_config = {"from_attributes": True}
