import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings

settings = get_settings()
auth = {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}


@pytest.mark.asyncio
async def test_budget_current_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/budget/current", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert "safe_to_spend" in data
    assert "categories" in data
    assert data["categories"] == []


@pytest.mark.asyncio
async def test_budget_reflects_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        cat = await c.post("/api/categories", json={"name": "Тест", "emoji": "🧪"}, headers=auth)
        cat_id = cat.json()["id"]
        await c.patch("/api/budget/limits", json=[{"category_id": cat_id, "limit_amount": "5000.00"}], headers=auth)
        await c.post("/api/transactions", json={"category_id": cat_id, "amount": "1000.00"}, headers=auth)
        resp = await c.get("/api/budget/current", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    cat_data = next(c for c in data["categories"] if c["category"]["id"] == cat_id)
    assert Decimal(cat_data["spent"]) == Decimal("1000.00")
    assert Decimal(cat_data["remaining"]) == Decimal("4000.00")
