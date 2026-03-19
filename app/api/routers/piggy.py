from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.deps import get_or_create_user
from app.api.schemas.piggy import PiggyCreate, PiggyUpdate, PiggyOut, ContributeBody
from app.db.base import get_db
from app.db.models import PiggyBank, PiggyContribution

router = APIRouter(prefix="/piggy", tags=["piggy"])


@router.get("", response_model=list[PiggyOut])
async def list_piggies(db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.is_active == True))
    return result.scalars().all()


@router.post("", response_model=PiggyOut, status_code=201)
async def create_piggy(body: PiggyCreate, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    pig = PiggyBank(
        name=body.name,
        target_amount=body.target_amount,
        target_date=body.target_date,
        current_amount=Decimal("0"),
    )
    db.add(pig)
    await db.commit()
    await db.refresh(pig)
    return pig


@router.patch("/{pig_id}", response_model=PiggyOut)
async def update_piggy(pig_id: int, body: PiggyUpdate, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.id == pig_id, PiggyBank.is_active == True))
    pig = result.scalar_one_or_none()
    if not pig:
        raise HTTPException(404, "Piggy bank not found")
    if body.name is not None:
        pig.name = body.name
    if body.target_amount is not None:
        pig.target_amount = body.target_amount
    if body.target_date is not None:
        pig.target_date = body.target_date
    await db.commit()
    await db.refresh(pig)
    return pig


@router.post("/{pig_id}/contribute", response_model=PiggyOut)
async def contribute(pig_id: int, body: ContributeBody, db: AsyncSession = Depends(get_db), tg_user: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.id == pig_id, PiggyBank.is_active == True))
    pig = result.scalar_one_or_none()
    if not pig:
        raise HTTPException(404, "Piggy bank not found")
    user = await get_or_create_user(tg_user, db)
    db.add(PiggyContribution(
        piggy_bank_id=pig_id,
        user_id=user.id,
        amount=body.amount,
    ))
    pig.current_amount = pig.current_amount + body.amount
    await db.commit()
    await db.refresh(pig)
    return pig


@router.delete("/{pig_id}", status_code=204)
async def delete_piggy(pig_id: int, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.id == pig_id, PiggyBank.is_active == True))
    pig = result.scalar_one_or_none()
    if not pig:
        raise HTTPException(404, "Piggy bank not found")
    pig.is_active = False
    await db.commit()
