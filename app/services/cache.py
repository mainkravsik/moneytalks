from redis.asyncio import Redis
from app.config import get_settings

settings = get_settings()
_redis: Redis | None = None

SAFE_TO_SPEND_KEY = "safe_to_spend"
SAFE_TO_SPEND_TTL = 60  # seconds


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_cached_safe_to_spend() -> float | None:
    try:
        r = get_redis()
        val = await r.get(SAFE_TO_SPEND_KEY)
        return float(val) if val is not None else None
    except Exception:
        return None  # Redis unavailable → cache miss


async def set_cached_safe_to_spend(value: float) -> None:
    try:
        r = get_redis()
        await r.setex(SAFE_TO_SPEND_KEY, SAFE_TO_SPEND_TTL, str(value))
    except Exception:
        pass  # Redis unavailable → skip caching


async def invalidate_safe_to_spend() -> None:
    try:
        r = get_redis()
        await r.delete(SAFE_TO_SPEND_KEY)
    except Exception:
        pass  # Redis unavailable → nothing to invalidate
