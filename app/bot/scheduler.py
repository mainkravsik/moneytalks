import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore
from sqlalchemy import select, func
from app.config import get_settings
from app.db.base import AsyncSessionLocal
from app.db.models import (
    BudgetLimit, Category, Transaction, Loan, BudgetPeriod, User
)
from app.services.period_db import get_or_create_period, get_current_period
from app.services.period import get_period_bounds
from app.services.notifications import weekly_report_text, monthly_reset_text, loan_reminder_text

settings = get_settings()
logger = logging.getLogger(__name__)


async def _send_to_all(bot, text: str):
    """Send a message to both Ilya and Alena."""
    for tg_id in settings.allowed_user_ids:
        try:
            await bot.send_message(tg_id, text, parse_mode="HTML")
        except Exception as e:
            logger.error(f"Failed to send to {tg_id}: {e}")


async def job_weekly_report(bot):
    async with AsyncSessionLocal() as db:
        period = await get_current_period(db)
        if not period:
            return

        period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        period_end = datetime.combine(period.end_date, datetime.min.time()).replace(tzinfo=timezone.utc)

        limits_q = await db.execute(
            select(BudgetLimit, Category)
            .join(Category)
            .where(BudgetLimit.period_id == period.id)
        )
        total_limit = sum(float(r.BudgetLimit.limit_amount) for r in limits_q)

        spent_q = await db.execute(
            select(Category.emoji, Category.name, func.sum(Transaction.amount).label("t"))
            .join(Transaction, Transaction.category_id == Category.id)
            .where(
                Transaction.is_deleted == False,
                Transaction.created_at >= period_start,
                Transaction.created_at < period_end,
            )
            .group_by(Category.id)
            .order_by(func.sum(Transaction.amount).desc())
        )
        rows = spent_q.all()
        total_spent = sum(float(r.t) for r in rows)
        top = [{"emoji": r.emoji, "name": r.name, "spent": float(r.t)} for r in rows]

    text = weekly_report_text(period.start_date, period.end_date, total_spent, total_limit, top)
    await _send_to_all(bot, text)


async def job_monthly_reset(bot):
    async with AsyncSessionLocal() as db:
        period = await get_or_create_period(db)
    text = monthly_reset_text(period.start_date, period.end_date)
    await _send_to_all(bot, text)


async def job_loan_reminders(bot):
    today = datetime.now(timezone.utc).date()
    in_3_days = today + timedelta(days=3)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Loan).where(Loan.is_active == True, Loan.next_payment_date == in_3_days)
        )
        loans = result.scalars().all()

    for loan in loans:
        text = loan_reminder_text(loan.name, float(loan.monthly_payment), 3)
        await _send_to_all(bot, text)


def create_scheduler(bot) -> AsyncIOScheduler:
    from urllib.parse import urlparse
    parsed = urlparse(settings.redis_url)
    jobstores = {"default": RedisJobStore(host=parsed.hostname or "redis", port=parsed.port or 6379)}
    scheduler = AsyncIOScheduler(jobstores=jobstores)

    # Weekly report every Monday at 10:00
    scheduler.add_job(job_weekly_report, "cron", day_of_week="mon", hour=10, minute=0, args=[bot])

    # Monthly reset on 10th at 09:00
    scheduler.add_job(job_monthly_reset, "cron", day=10, hour=9, minute=0, args=[bot])

    # Loan reminders daily at 09:00
    scheduler.add_job(job_loan_reminders, "cron", hour=9, minute=0, args=[bot])

    # Debug: trigger scheduler jobs immediately on startup
    if settings.debug_trigger_scheduler == "weekly":
        scheduler.add_job(job_weekly_report, "date", run_date=datetime.now(timezone.utc), args=[bot])
    elif settings.debug_trigger_scheduler == "monthly":
        scheduler.add_job(job_monthly_reset, "date", run_date=datetime.now(timezone.utc), args=[bot])

    return scheduler
