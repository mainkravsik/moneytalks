import hashlib
import hmac
import json
import time
import urllib.parse

from fastapi import HTTPException, Request

from app.config import get_settings

settings = get_settings()
MAX_AGE_SECONDS = 3600  # 1 hour


def validate_init_data(init_data: str) -> dict:
    """Validate Telegram initData HMAC. Returns parsed user dict or raises HTTPException."""
    params = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing hash")

    if "auth_date" not in params:
        raise HTTPException(status_code=401, detail="Missing auth_date")
    auth_date = int(params["auth_date"])
    if time.time() - auth_date > MAX_AGE_SECONDS:
        raise HTTPException(status_code=401, detail="initData expired")

    data_check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid signature")

    user = json.loads(params.get("user", "{}"))
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Missing user field")
    if user["id"] not in settings.allowed_user_ids:
        raise HTTPException(status_code=403, detail="User not allowed")

    return user


async def get_tg_user(request: Request) -> dict:
    """FastAPI dependency — extracts and validates Telegram initData from header."""
    init_data = request.headers.get("X-Telegram-Init-Data")
    if not init_data:
        raise HTTPException(status_code=401, detail="Missing X-Telegram-Init-Data header")
    return validate_init_data(init_data)
