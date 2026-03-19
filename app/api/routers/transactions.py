from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut
from app.db.base import get_db
from app.db.models import Transaction, User
from app.services.period_db import get_or_create_period, get_current_period
from app.services.cache import invalidate_safe_to_spend

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _get_or_create_user(tg_user: dict, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.telegram_id == tg_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        user = User(telegram_id=tg_user["id"], name=tg_user.get("first_name", "User"))
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("", response_model=TransactionOut, status_code=201)
async def add_transaction(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    tg_user: dict = Depends(get_tg_user),
):
    user = await _get_or_create_user(tg_user, db)
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
    return result.scalars().all()


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
