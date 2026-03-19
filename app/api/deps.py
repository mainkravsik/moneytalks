from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User


async def get_or_create_user(tg_user: dict, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.telegram_id == tg_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        user = User(telegram_id=tg_user["id"], name=tg_user.get("first_name", "User"))
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
