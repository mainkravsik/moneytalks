import os

# Set test env vars BEFORE any app imports (settings are cached)
os.environ.setdefault("BOT_TOKEN", "test_token:ABC")
os.environ.setdefault("ILYA_TG_ID", "111")
os.environ.setdefault("ALENA_TG_ID", "222")
os.environ.setdefault("WEBHOOK_URL", "https://example.com/webhook")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-minimum!")

from app.config import get_settings
get_settings.cache_clear()
