import pytest
from httpx import AsyncClient, ASGITransport
from tests.test_auth import make_init_data
from app.api.app import app
from app.config import get_settings

settings = get_settings()


@pytest.mark.asyncio
async def test_health_returns_ok():
    init_data = make_init_data(settings.ilya_tg_id, settings.bot_token)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health", headers={"X-Telegram-Init-Data": init_data})
    assert resp.json() == {"status": "ok", "user_id": settings.ilya_tg_id}
