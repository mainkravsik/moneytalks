from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.category import CategoryCreate, CategoryOut
from app.db.base import get_db
from app.db.models import Category

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Category).where(Category.is_active == True))
    return result.scalars().all()


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    cat = Category(name=body.name, emoji=body.emoji)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.is_active = False
    await db.commit()
