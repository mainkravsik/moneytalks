from decimal import Decimal
from pydantic import BaseModel
from app.api.schemas.category import CategoryOut


class CategoryBudget(BaseModel):
    category: CategoryOut
    limit: Decimal
    spent: Decimal
    remaining: Decimal
    percent_used: float  # 0.0–1.0+


class LimitUpdate(BaseModel):
    category_id: int
    limit_amount: Decimal


class BudgetCurrentResponse(BaseModel):
    period_year: int
    period_month: int
    start_date: str
    end_date: str
    total_limit: Decimal
    total_spent: Decimal
    safe_to_spend: Decimal
    categories: list[CategoryBudget]
