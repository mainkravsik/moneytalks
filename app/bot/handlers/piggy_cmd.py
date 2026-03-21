from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import PiggyBank

router = Router()


@router.message(Command("piggy"))
async def cmd_piggy(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(PiggyBank).where(PiggyBank.is_active == True))
        piggies = result.scalars().all()

    if not piggies:
        await message.answer("🐷 Копилок пока нет. Создай в мини-апп.")
        return

    lines = ["🐷 <b>Копилки</b>"]
    for pig in piggies:
        current = float(pig.current_amount)
        if pig.target_amount:
            target = float(pig.target_amount)
            pct = int(current / target * 100)
            bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
            lines.append(f"\n{pig.name}\n{bar} ₽{current:.0f} / ₽{target:.0f} ({pct}%)")
        else:
            lines.append(f"\n{pig.name}: ₽{current:.0f}")

    await message.answer("\n".join(lines), parse_mode="HTML")
