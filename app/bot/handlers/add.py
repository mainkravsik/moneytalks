from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import Category, User, Transaction
from app.services.period_db import get_or_create_period
from app.services.cache import invalidate_safe_to_spend

router = Router()


class AddTx(StatesGroup):
    choosing_category = State()
    entering_amount = State()


async def _get_or_create_user(telegram_id: int, first_name: str = "User") -> User:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()
        if not user:
            user = User(telegram_id=telegram_id, name=first_name)
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user


@router.message(Command("add"))
async def cmd_add(message: Message, state: FSMContext):
    """Start add flow: show category keyboard or parse inline args."""
    # from_user is guaranteed non-None by WhitelistMiddleware
    from_user = message.from_user  # type: ignore[union-attr]

    # Check for inline format: /add 500 категория
    args = message.text.split(maxsplit=2)[1:]  # type: ignore[union-attr]
    if len(args) >= 2:
        try:
            amount = float(args[0].replace(",", "."))
        except ValueError:
            await message.answer("❌ Формат: /add <сумма> <категория>\nНапример: /add 500 продукты")
            return

        category_name = args[1].lower()
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Category).where(
                    Category.name.ilike(f"%{category_name}%"),
                    Category.is_active == True,
                )
            )
            cat = result.scalars().first()
            if cat:
                user = await _get_or_create_user(from_user.id, from_user.first_name)
                async with AsyncSessionLocal() as db2:
                    await get_or_create_period(db2)
                    db2.add(Transaction(user_id=user.id, category_id=cat.id, amount=amount))
                    await db2.commit()
                await invalidate_safe_to_spend()
                await message.answer(
                    f"✅ Записал: ₽{amount:.0f} · {cat.emoji} {cat.name} · {from_user.first_name}"
                )
                return
            # Category not found — fall through to keyboard

    # Show category keyboard
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Category).where(Category.is_active == True).order_by(Category.name))
        categories = result.scalars().all()

    if not categories:
        await message.answer("❌ Категории не настроены. Открой мини-апп и настрой бюджет.")
        return

    buttons = [
        [InlineKeyboardButton(text=f"{c.emoji} {c.name}", callback_data=f"add_cat:{c.id}")]
        for c in categories
    ]
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    await message.answer("Выбери категорию:", reply_markup=keyboard)
    await state.set_state(AddTx.choosing_category)


@router.callback_query(F.data.startswith("add_cat:"), AddTx.choosing_category)
async def on_category_chosen(cb: CallbackQuery, state: FSMContext):
    cat_id = int(cb.data.split(":")[1])  # type: ignore[union-attr]
    await state.update_data(category_id=cat_id)
    await cb.message.edit_text("Введи сумму (например: 450):")  # type: ignore[union-attr]
    await state.set_state(AddTx.entering_amount)
    await cb.answer()


@router.message(AddTx.entering_amount)
async def on_amount_entered(message: Message, state: FSMContext):
    from_user = message.from_user  # type: ignore[union-attr]
    try:
        amount = float(message.text.replace(",", "."))  # type: ignore[union-attr]
        if amount <= 0:
            raise ValueError("Amount must be positive")
    except ValueError:
        await message.answer("❌ Введи положительное число, например: 450")
        return

    data = await state.get_data()
    cat_id = data["category_id"]

    async with AsyncSessionLocal() as db:
        cat_result = await db.execute(select(Category).where(Category.id == cat_id))
        cat = cat_result.scalar_one_or_none()
        if not cat:
            await state.clear()
            await message.answer("❌ Категория не найдена. Попробуй /add заново.")
            return

        user = await _get_or_create_user(from_user.id, from_user.first_name)
        await get_or_create_period(db)
        db.add(Transaction(user_id=user.id, category_id=cat_id, amount=amount))
        await db.commit()

    await invalidate_safe_to_spend()
    await state.clear()
    await message.answer(
        f"✅ Записал: ₽{amount:.0f} · {cat.emoji} {cat.name} · {from_user.first_name}"
    )
