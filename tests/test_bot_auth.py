import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiogram.types import Message, CallbackQuery
from app.bot.middlewares.auth import WhitelistMiddleware
from app.config import get_settings

settings = get_settings()


def _make_message_event(user_id: int) -> MagicMock:
    """Create a Message-spec mock with a given from_user.id."""
    event = MagicMock(spec=Message)
    event.from_user = MagicMock()
    event.from_user.id = user_id
    event.answer = AsyncMock()
    return event


def _make_callback_event(user_id: int) -> MagicMock:
    """Create a CallbackQuery-spec mock with a given from_user.id."""
    event = MagicMock(spec=CallbackQuery)
    event.from_user = MagicMock()
    event.from_user.id = user_id
    event.answer = AsyncMock()
    return event


@pytest.mark.asyncio
async def test_allowed_user_message_passes():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock(return_value="ok")
    event = _make_message_event(settings.ilya_tg_id)
    await middleware(handler, event, {})
    handler.assert_called_once()


@pytest.mark.asyncio
async def test_unknown_user_message_blocked():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock()
    event = _make_message_event(99999999)
    await middleware(handler, event, {})
    handler.assert_not_called()
    event.answer.assert_called_once()


@pytest.mark.asyncio
async def test_unknown_user_callback_blocked_with_answer():
    """Unknown CallbackQuery user is blocked and gets an alert (no spinner hang)."""
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock()
    event = _make_callback_event(99999999)
    await middleware(handler, event, {})
    handler.assert_not_called()
    event.answer.assert_called_once_with("⛔ Нет доступа.", show_alert=True)


@pytest.mark.asyncio
async def test_allowed_user_callback_passes():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock(return_value="ok")
    event = _make_callback_event(settings.alena_tg_id)
    await middleware(handler, event, {})
    handler.assert_called_once()


@pytest.mark.asyncio
async def test_none_from_user_blocked():
    """Events with no from_user (e.g. channel posts) are always blocked."""
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock()
    event = MagicMock(spec=Message)
    event.from_user = None
    event.answer = AsyncMock()
    await middleware(handler, event, {})
    handler.assert_not_called()
