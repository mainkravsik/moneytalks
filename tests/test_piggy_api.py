import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings
settings = get_settings()

auth = {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}


@pytest.mark.asyncio
async def test_create_piggy():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post("/api/piggy", json={"name": "Отпуск", "target_amount": 50000}, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Отпуск"
    assert float(data["current_amount"]) == 0.0


@pytest.mark.asyncio
async def test_contribute_to_piggy():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        pig = await c.post("/api/piggy", json={"name": "Машина"}, headers=auth)
        pig_id = pig.json()["id"]
        resp = await c.post(f"/api/piggy/{pig_id}/contribute", json={"amount": 5000}, headers=auth)
        pig_after = await c.get("/api/piggy", headers=auth)
    assert resp.status_code == 200
    pigs = pig_after.json()
    updated = next(p for p in pigs if p["id"] == pig_id)
    assert float(updated["current_amount"]) == 5000.0


@pytest.mark.asyncio
async def test_delete_piggy():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        pig = await c.post("/api/piggy", json={"name": "Удалить"}, headers=auth)
        pig_id = pig.json()["id"]
        resp = await c.delete(f"/api/piggy/{pig_id}", headers=auth)
        pigs = await c.get("/api/piggy", headers=auth)
    assert resp.status_code == 204
    ids = [p["id"] for p in pigs.json()]
    assert pig_id not in ids
