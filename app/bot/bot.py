from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from app.config import get_settings
from app.bot.middlewares.auth import WhitelistMiddleware
from app.bot.handlers.start import router as start_router

settings = get_settings()


def create_bot() -> Bot:
    return Bot(token=settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.message.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.callback_query.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.include_router(start_router)
    return dp
