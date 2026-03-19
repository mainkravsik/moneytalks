import logging
from decimal import Decimal
from redis.asyncio import Redis
from app.config import get_settings

settings = get_settings()
_redis: Redis | None = None
logger = logging.getLogger(__name__)

SAFE_TO_SPEND_KEY = "safe_to_spend"
SAFE_TO_SPEND_TTL = 60  # seconds


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_cached_safe_to_spend() -> Decimal | None:
    try:
        r = get_redis()
        val = await r.get(SAFE_TO_SPEND_KEY)
        return Decimal(val) if val is not None else None
    except Exception as e:
        logger.warning("Redis get failed (cache miss): %s", e)
        return None  # Redis unavailable → cache miss


async def set_cached_safe_to_spend(value: Decimal) -> None:
    try:
        r = get_redis()
        await r.setex(SAFE_TO_SPEND_KEY, SAFE_TO_SPEND_TTL, str(value))
    except Exception as e:
        logger.warning("Redis set failed (skipping cache): %s", e)


async def invalidate_safe_to_spend() -> None:
    try:
        r = get_redis()
        await r.delete(SAFE_TO_SPEND_KEY)
    except Exception as e:
        logger.warning("Redis delete failed (cache may be stale): %s", e)
