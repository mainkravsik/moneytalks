import hashlib
import hmac
import time
import json
import urllib.parse

import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from app.config import get_settings

settings = get_settings()


def make_init_data(user_id: int, bot_token: str, age_seconds: int = 0) -> str:
    """Generate a valid Telegram initData string."""
    auth_date = int(time.time()) - age_seconds
    user_json = json.dumps({"id": user_id, "first_name": "Test"})
    # Use sorted() to match production validate_init_data logic exactly
    params = {"auth_date": str(auth_date), "user": user_json}
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    hash_ = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode({
        "auth_date": auth_date,
        "user": user_json,
        "hash": hash_,
    })


@pytest.mark.asyncio
async def test_valid_auth_passes():
    init_data = make_init_data(settings.ilya_tg_id, settings.bot_token)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health", headers={"X-Telegram-Init-Data": init_data})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_wrong_user_rejected():
    init_data = make_init_data(99999999, settings.bot_token)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health", headers={"X-Telegram-Init-Data": init_data})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_expired_init_data_rejected():
    init_data = make_init_data(settings.ilya_tg_id, settings.bot_token, age_seconds=7200)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health", headers={"X-Telegram-Init-Data": init_data})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_missing_header_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_tampered_signature_rejected():
    """Valid structure and allowed user, but signed with wrong token."""
    init_data = make_init_data(settings.ilya_tg_id, "wrong_token:XYZ")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health", headers={"X-Telegram-Init-Data": init_data})
    assert resp.status_code == 401
