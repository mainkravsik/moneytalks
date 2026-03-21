from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.redis import RedisStorage
from app.config import get_settings
from app.bot.middlewares.auth import WhitelistMiddleware
from app.bot.handlers.start import router as start_router
from app.bot.handlers.add import router as add_router
from app.bot.handlers.budget_cmd import router as budget_cmd_router
from app.bot.handlers.piggy_cmd import router as piggy_cmd_router
from app.bot.handlers.debt_cmd import router as debt_cmd_router

settings = get_settings()


def create_bot() -> Bot:
    return Bot(token=settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))


def create_dispatcher() -> Dispatcher:
    storage = RedisStorage.from_url(settings.redis_url)
    dp = Dispatcher(storage=storage)
    dp.message.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.callback_query.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.include_router(start_router)
    dp.include_router(add_router)
    dp.include_router(budget_cmd_router)
    dp.include_router(piggy_cmd_router)
    dp.include_router(debt_cmd_router)
    return dp
