import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings

settings = get_settings()
auth = {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}


@pytest.mark.asyncio
async def test_add_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # Create a category first
        cat = await c.post("/api/categories", json={"name": "Еда", "emoji": "🛒"}, headers=auth)
        cat_id = cat.json()["id"]
        # Add transaction
        resp = await c.post("/api/transactions", json={
            "category_id": cat_id, "amount": "500.00", "comment": "Пятёрочка"
        }, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert Decimal(data["amount"]) == Decimal("500.00")
    assert data["is_deleted"] is False


@pytest.mark.asyncio
async def test_list_transactions_current_period():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        cat = await c.post("/api/categories", json={"name": "Еда2", "emoji": "🛒"}, headers=auth)
        cat_id = cat.json()["id"]
        await c.post("/api/transactions", json={"category_id": cat_id, "amount": "100.00"}, headers=auth)
        resp = await c.get("/api/transactions", headers=auth)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_soft_delete_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        cat = await c.post("/api/categories", json={"name": "Еда3", "emoji": "🛒"}, headers=auth)
        cat_id = cat.json()["id"]
        tx = await c.post("/api/transactions", json={"category_id": cat_id, "amount": "200.00"}, headers=auth)
        tx_id = tx.json()["id"]
        del_resp = await c.delete(f"/api/transactions/{tx_id}", headers=auth)
        list_resp = await c.get("/api/transactions", headers=auth)
    assert del_resp.status_code == 204
    ids = [t["id"] for t in list_resp.json()]
    assert tx_id not in ids
