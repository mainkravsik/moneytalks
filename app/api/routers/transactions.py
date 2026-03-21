from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.deps import get_or_create_user
from app.api.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut
from app.db.base import get_db
from app.db.models import Transaction, User, Category, BudgetLimit
from app.services.period_db import get_or_create_period, get_current_period
from app.services.cache import invalidate_safe_to_spend
from app.services.notifications import limit_exceeded_text
from app.config import get_settings as _get_settings

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
async def add_transaction(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    tg_user: dict = Depends(get_tg_user),
):
    user = await get_or_create_user(tg_user, db)
    await get_or_create_period(db)  # ensure period exists
    tx = Transaction(
        user_id=user.id,
        category_id=body.category_id,
        amount=body.amount,
        comment=body.comment,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    await invalidate_safe_to_spend()

    # Check if limit exceeded for this category in the current period
    period = await get_or_create_period(db)
    limit_q = await db.execute(
        select(BudgetLimit).where(
            BudgetLimit.period_id == period.id,
            BudgetLimit.category_id == body.category_id,
        )
    )
    budget_limit = limit_q.scalar_one_or_none()
    if budget_limit:
        spent_q = await db.execute(
            select(func.sum(Transaction.amount))
            .where(
                Transaction.category_id == body.category_id,
                Transaction.is_deleted == False,
                Transaction.created_at >= datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc),
            )
        )
        total_spent = float(spent_q.scalar() or 0)
        limit_val = float(budget_limit.limit_amount)
        if total_spent > limit_val:
            cat_q = await db.execute(select(Category).where(Category.id == body.category_id))
            cat = cat_q.scalar_one_or_none()
            if cat:
                from aiogram import Bot
                _s = _get_settings()
                _bot = Bot(token=_s.bot_token)
                for tg_id in _s.allowed_user_ids:
                    try:
                        await _bot.send_message(
                            tg_id,
                            limit_exceeded_text(cat.emoji, cat.name, total_spent, limit_val),
                            parse_mode="HTML"
                        )
                    except Exception:
                        pass
                await _bot.session.close()

    return tx


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    tg_user: dict = Depends(get_tg_user),
    category_id: int | None = None,
    user_id: int | None = None,
):
    period = await get_current_period(db)
    if not period:
        return []

    period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    # Use +1 day to include full last day of period
    period_end = datetime.combine(period.end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)

    q = select(Transaction).where(
        Transaction.is_deleted == False,
        Transaction.created_at >= period_start,
        Transaction.created_at < period_end,
    )
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if user_id:
        result_user = await db.execute(select(User).where(User.telegram_id == user_id))
        u = result_user.scalar_one_or_none()
        if not u:
            return []  # unknown user → no transactions (don't silently drop filter)
        q = q.where(Transaction.user_id == u.id)

    result = await db.execute(q.order_by(Transaction.created_at.desc()))
    txs = result.scalars().all()

    # Load categories and users in bulk
    cat_ids = list({tx.category_id for tx in txs})
    user_ids = list({tx.user_id for tx in txs})
    cats_result = await db.execute(select(Category).where(Category.id.in_(cat_ids)))
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    cats_map = {c.id: c for c in cats_result.scalars().all()}
    users_map = {u.id: u for u in users_result.scalars().all()}

    out = []
    for tx in txs:
        cat = cats_map.get(tx.category_id)
        usr = users_map.get(tx.user_id)
        out.append(TransactionOut(
            id=tx.id,
            user_id=tx.user_id,
            category_id=tx.category_id,
            amount=tx.amount,
            comment=tx.comment,
            is_deleted=tx.is_deleted,
            created_at=tx.created_at,
            category_name=cat.name if cat else None,
            category_emoji=cat.emoji if cat else None,
            user_name=usr.name if usr else None,
        ))
    return out


@router.patch("/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: int,
    body: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.is_deleted:
        raise HTTPException(404, "Transaction not found")
    if body.amount is not None:
        tx.amount = body.amount
    if body.comment is not None:
        tx.comment = body.comment
    if body.category_id is not None:
        tx.category_id = body.category_id
    await db.commit()
    await db.refresh(tx)
    await invalidate_safe_to_spend()
    return tx


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: int,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.is_deleted:
        raise HTTPException(404, "Transaction not found")
    tx.is_deleted = True
    await db.commit()
    await invalidate_safe_to_spend()
