from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone
from app.db.base import AsyncSessionLocal
from app.db.models import BudgetLimit, Category, Transaction
from app.services.period_db import get_current_period

router = Router()


@router.message(Command("budget"))
async def cmd_budget(message: Message):
    async with AsyncSessionLocal() as db:
        period = await get_current_period(db)
        if not period:
            await message.answer("📭 Бюджет ещё не настроен. Открой мини-апп.")
            return

        limits_q = await db.execute(
            select(BudgetLimit, Category)
            .join(Category, BudgetLimit.category_id == Category.id)
            .where(BudgetLimit.period_id == period.id, Category.is_active == True)
        )
        limits_rows = limits_q.all()

        period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        period_end = datetime.combine(period.end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)

        spent_q = await db.execute(
            select(Transaction.category_id, func.sum(Transaction.amount).label("t"))
            .where(
                Transaction.is_deleted == False,
                Transaction.created_at >= period_start,
                Transaction.created_at < period_end,
            )
            .group_by(Transaction.category_id)
        )
        spent_map = {row[0]: float(row[1]) for row in spent_q.all()}

    if not limits_rows:
        await message.answer("📭 Категории и лимиты не настроены. Открой мини-апп.")
        return

    lines = [f"📊 Бюджет {period.start_date} – {period.end_date}\n"]
    for row in limits_rows:
        cat = row.Category
        limit = float(row.BudgetLimit.limit_amount)
        spent = spent_map.get(cat.id, 0.0)
        pct = int(spent / limit * 100) if limit > 0 else 0
        filled = min(pct // 10, 10)
        bar = "█" * filled + "░" * (10 - filled)
        status = "⚠️ " if spent > limit else ""
        lines.append(f"{status}{cat.emoji} {cat.name}\n{bar} {spent:.0f} / {limit:.0f} ₽")

    await message.answer("\n\n".join(lines))
