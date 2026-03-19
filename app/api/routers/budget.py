import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.budget import BudgetCurrentResponse, CategoryBudget, LimitUpdate
from app.api.schemas.category import CategoryOut
from app.db.base import get_db
from app.db.models import BudgetLimit, Category, Transaction, Loan, LoanPayment
from app.services.period_db import get_or_create_period
from app.services.budget import calculate_safe_to_spend
from app.services.cache import get_cached_safe_to_spend, set_cached_safe_to_spend, invalidate_safe_to_spend

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/budget", tags=["budget"])


@router.get("/current", response_model=BudgetCurrentResponse)
async def get_budget_current(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    period = await get_or_create_period(db)

    # Limits joined with categories
    limits_q = await db.execute(
        select(BudgetLimit, Category)
        .join(Category, BudgetLimit.category_id == Category.id)
        .where(BudgetLimit.period_id == period.id, Category.is_active == True)
    )
    limits_rows = limits_q.all()
    limits_map = {row.BudgetLimit.category_id: row.BudgetLimit.limit_amount for row in limits_rows}

    # Period time bounds
    period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    period_end = datetime.combine(period.end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)

    # Spent per category this period
    spent_q = await db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount).label("total"))
        .where(
            Transaction.is_deleted == False,
            Transaction.created_at >= period_start,
            Transaction.created_at < period_end,
        )
        .group_by(Transaction.category_id)
    )
    spent_map = {row.category_id: Decimal(str(row.total)) for row in spent_q}

    # Unpaid loan payments — scoped to this period (both start and end bounds)
    paid_loan_ids_q = await db.execute(
        select(LoanPayment.loan_id)
        .where(
            LoanPayment.paid_at >= period_start,
            LoanPayment.paid_at < period_end,
        )
        .distinct()
    )
    paid_loan_ids = {row[0] for row in paid_loan_ids_q}

    unpaid_loans_q = await db.execute(
        select(func.sum(Loan.monthly_payment))
        .where(Loan.is_active == True, ~Loan.id.in_(paid_loan_ids))
    )
    unpaid_loans = Decimal(str(unpaid_loans_q.scalar() or 0))

    # Build category budgets
    categories = []
    total_limit = Decimal("0")
    total_spent = Decimal("0")

    for row in limits_rows:
        cat = row.Category
        limit = Decimal(str(row.BudgetLimit.limit_amount))
        spent = spent_map.get(cat.id, Decimal("0"))
        total_limit += limit
        total_spent += spent
        categories.append(CategoryBudget(
            category=CategoryOut.model_validate(cat),
            limit=limit,
            spent=spent,
            remaining=limit - spent,
            percent_used=float(spent / limit) if limit > 0 else 0.0,
        ))

    # Count spent for categories without limits too
    for cat_id, spent in spent_map.items():
        if cat_id not in limits_map:
            total_spent += spent

    # safe_to_spend with Redis cache
    cached = await get_cached_safe_to_spend()
    if cached is None:
        safe = calculate_safe_to_spend(total_limit, total_spent, unpaid_loans)
        await set_cached_safe_to_spend(safe)
    else:
        safe = cached

    return BudgetCurrentResponse(
        period_year=period.year,
        period_month=period.month,
        start_date=str(period.start_date),
        end_date=str(period.end_date),
        total_limit=total_limit,
        total_spent=total_spent,
        safe_to_spend=safe,
        categories=sorted(categories, key=lambda c: c.percent_used, reverse=True),
    )


@router.patch("/limits", status_code=200)
async def update_limits(
    body: list[LimitUpdate],
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    period = await get_or_create_period(db)

    # Fetch all existing limits for this period in one query (avoid N+1)
    category_ids = [item.category_id for item in body]
    existing_q = await db.execute(
        select(BudgetLimit).where(
            BudgetLimit.period_id == period.id,
            BudgetLimit.category_id.in_(category_ids),
        )
    )
    existing_map = {row.category_id: row for row in existing_q.scalars()}

    for item in body:
        if item.category_id in existing_map:
            existing_map[item.category_id].limit_amount = item.limit_amount
        else:
            db.add(BudgetLimit(
                period_id=period.id,
                category_id=item.category_id,
                limit_amount=item.limit_amount,
            ))

    await db.commit()
    # Invalidate cache — changing limits changes safe_to_spend
    await invalidate_safe_to_spend()
    return {"updated": len(body)}
