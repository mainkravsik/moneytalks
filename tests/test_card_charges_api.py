import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings

settings = get_settings()
auth = {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def card(client):
    resp = await client.post("/api/loans", json={
        "loan_type": "card",
        "name": "Test Card",
        "bank": "Sber",
        "credit_limit": 350000,
        "remaining_amount": 0,
        "interest_rate": 25.4,
        "monthly_payment": 0,
        "next_payment_date": "2026-04-01",
        "grace_period_months": 3,
        "min_payment_pct": 0.03,
        "min_payment_floor": 150,
    }, headers=auth)
    assert resp.status_code == 201
    return resp.json()


async def test_add_charge_purchase(client, card):
    resp = await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 5000,
        "description": "Groceries",
        "charge_type": "purchase",
        "charge_date": "2026-03-15",
    }, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert float(data["amount"]) == 5000
    assert data["grace_deadline"] == "2026-06-30"
    assert data["status"] == "in_grace"


async def test_add_charge_transfer_no_grace(client, card):
    resp = await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 10000,
        "description": "Transfer",
        "charge_type": "transfer",
        "charge_date": "2026-03-15",
    }, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["grace_deadline"] is None
    assert data["status"] == "no_grace"


async def test_add_charge_updates_remaining(client, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 5000, "description": "Test",
        "charge_type": "purchase", "charge_date": "2026-03-15",
    }, headers=auth)
    resp = await client.get("/api/loans", headers=auth)
    loans = resp.json()
    updated = [l for l in loans if l["id"] == card["id"]][0]
    assert float(updated["remaining_amount"]) == 5000.0


async def test_list_charges(client, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 1000, "description": "A", "charge_type": "purchase", "charge_date": "2026-03-01",
    }, headers=auth)
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 2000, "description": "B", "charge_type": "purchase", "charge_date": "2026-03-15",
    }, headers=auth)
    resp = await client.get(f"/api/loans/{card['id']}/charges?month=2026-03", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


async def test_delete_charge(client, card):
    resp = await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 3000, "description": "Del", "charge_type": "purchase", "charge_date": "2026-03-10",
    }, headers=auth)
    charge_id = resp.json()["id"]
    del_resp = await client.delete(f"/api/loans/{card['id']}/charges/{charge_id}", headers=auth)
    assert del_resp.status_code == 204
    loans_resp = await client.get("/api/loans", headers=auth)
    updated = [l for l in loans_resp.json() if l["id"] == card["id"]][0]
    assert float(updated["remaining_amount"]) == 0.0


async def test_card_summary(client, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 10000, "description": "Buy", "charge_type": "purchase", "charge_date": "2026-01-15",
    }, headers=auth)
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 5000, "description": "Xfer", "charge_type": "transfer", "charge_date": "2026-03-01",
    }, headers=auth)
    resp = await client.get(f"/api/loans/{card['id']}/card-summary", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["total_debt"]) == 15000.0
    assert float(data["non_grace_debt"]) == 5000.0
    assert len(data["grace_buckets"]) >= 1


async def test_card_payoff(client, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 100000, "description": "Big buy", "charge_type": "purchase", "charge_date": "2026-03-01",
    }, headers=auth)
    resp = await client.get(f"/api/loans/{card['id']}/card-payoff?monthly_payment=30000", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_months"] > 0
    assert data["total_paid"] > 0
    assert "zero_interest" in data["recommendations"]
    assert "close_in_6" in data["recommendations"]
    assert "close_in_12" in data["recommendations"]
