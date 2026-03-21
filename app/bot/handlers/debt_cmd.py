from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import Loan

router = Router()


@router.message(Command("debt"))
async def cmd_debt(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Loan).where(Loan.is_active == True))
        loans = result.scalars().all()

    if not loans:
        await message.answer("💳 Кредитов нет. Добавь в мини-апп.")
        return

    total = sum(float(l.remaining_amount) for l in loans)
    lines = [f"💳 <b>Кредиты</b> (итого: ₽{total:.0f})\n"]
    for loan in loans:
        remaining = float(loan.remaining_amount)
        pct = int((1 - remaining / float(loan.original_amount)) * 100)
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        lines.append(
            f"{loan.name}{' · ' + loan.bank if loan.bank else ''}\n"
            f"{bar} ₽{remaining:.0f} · {loan.interest_rate}%\n"
            f"Платёж: ₽{float(loan.monthly_payment):.0f} · след. {loan.next_payment_date}"
        )

    await message.answer("\n\n".join(lines), parse_mode="HTML")
