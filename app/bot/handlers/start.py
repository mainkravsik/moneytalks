from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    # from_user is guaranteed non-None here: WhitelistMiddleware blocks if None
    name = message.from_user.first_name  # type: ignore[union-attr]
    await message.answer(
        f"👋 Привет, {name}!\n\n"
        "Я веду семейный бюджет для Ильи и Алёны.\n\n"
        "Команды:\n"
        "/add — добавить трату\n"
        "/budget — остаток по категориям\n"
        "/report — отчёт за период\n"
        "/piggy — копилки\n"
        "/debt — кредиты"
    )
