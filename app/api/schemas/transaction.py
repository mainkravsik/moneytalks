from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    category_id: int
    amount: Decimal
    comment: str | None = None


class TransactionUpdate(BaseModel):
    amount: Decimal | None = None
    comment: str | None = None
    category_id: int | None = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    category_id: int
    amount: Decimal
    comment: str | None
    is_deleted: bool
    created_at: datetime

    model_config = {"from_attributes": True}
