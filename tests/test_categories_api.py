import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings

settings = get_settings()


@pytest.fixture
def auth_headers():
    return {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}


@pytest.mark.asyncio
async def test_get_categories_returns_list(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/categories", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_category(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/categories", json={"name": "Тест", "emoji": "🧪"}, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Тест"
    assert data["emoji"] == "🧪"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_delete_category(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create first
        create = await client.post("/api/categories", json={"name": "Удалить", "emoji": "🗑"}, headers=auth_headers)
        cat_id = create.json()["id"]
        # Soft delete
        resp = await client.delete(f"/api/categories/{cat_id}", headers=auth_headers)
    assert resp.status_code == 204
