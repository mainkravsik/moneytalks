import pytest
from unittest.mock import AsyncMock, MagicMock
from app.bot.middlewares.auth import WhitelistMiddleware
from app.config import get_settings

settings = get_settings()


@pytest.mark.asyncio
async def test_allowed_user_passes():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock(return_value="ok")
    event = MagicMock()
    event.from_user.id = settings.ilya_tg_id
    result = await middleware(handler, event, {})
    handler.assert_called_once()


@pytest.mark.asyncio
async def test_unknown_user_blocked():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock()
    event = MagicMock()
    event.from_user.id = 99999999
    result = await middleware(handler, event, {})
    handler.assert_not_called()
