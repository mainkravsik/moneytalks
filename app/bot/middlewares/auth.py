from typing import Callable, Awaitable, Any
from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Message, CallbackQuery


class WhitelistMiddleware(BaseMiddleware):
    def __init__(self, allowed_ids: set[int]):
        self.allowed_ids = allowed_ids

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict], Awaitable[Any]],
        event: TelegramObject,
        data: dict,
    ) -> Any:
        # Extract from_user from any event type (None for channel posts, etc.)
        if isinstance(event, (Message, CallbackQuery)):
            user = event.from_user
        else:
            user = getattr(event, "from_user", None)

        # Block if from_user is missing or not in whitelist
        if user is None or user.id not in self.allowed_ids:
            if isinstance(event, Message):
                await event.answer("⛔ Нет доступа.")
            elif isinstance(event, CallbackQuery):
                await event.answer("⛔ Нет доступа.", show_alert=True)
            return None

        return await handler(event, data)
