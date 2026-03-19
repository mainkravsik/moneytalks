from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import BudgetPeriod, BudgetLimit
from app.services.period import find_period_for_date, get_period_bounds


async def get_current_period(db: AsyncSession) -> BudgetPeriod | None:
    today = date.today()
    year, month = find_period_for_date(today)
    result = await db.execute(
        select(BudgetPeriod).where(
            BudgetPeriod.year == year,
            BudgetPeriod.month == month,
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_period(db: AsyncSession) -> BudgetPeriod:
    """Get current period or create it (copying limits from previous period)."""
    period = await get_current_period(db)
    if period:
        return period

    today = date.today()
    year, month = find_period_for_date(today)
    start, end = get_period_bounds(year, month)

    new_period = BudgetPeriod(year=year, month=month, start_date=start, end_date=end)
    db.add(new_period)
    await db.flush()  # get new_period.id

    # Copy limits from previous period
    prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
    prev = await db.execute(
        select(BudgetPeriod).where(
            BudgetPeriod.year == prev_year,
            BudgetPeriod.month == prev_month,
        )
    )
    prev_period = prev.scalar_one_or_none()
    if prev_period:
        limits = await db.execute(
            select(BudgetLimit).where(BudgetLimit.period_id == prev_period.id)
        )
        for limit in limits.scalars():
            db.add(BudgetLimit(
                period_id=new_period.id,
                category_id=limit.category_id,
                limit_amount=limit.limit_amount,
            ))

    await db.commit()
    await db.refresh(new_period)
    return new_period
