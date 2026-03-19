# MoneyTalks — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete project skeleton — Docker Compose infra, PostgreSQL schema with Alembic, FastAPI app with initData auth, aiogram bot with whitelist middleware, and Nginx — so that both users can send `/start` and the Mini App shell loads over HTTPS.

**Architecture:** Single Python process runs aiogram bot (webhook mode) + FastAPI REST API together via asyncio. Nginx proxies `/webhook` and `/api/*` to the Python app and serves the React frontend as static files. PostgreSQL stores all data; Redis backs APScheduler and caches `safe_to_spend`.

**Tech Stack:** Python 3.12, aiogram 3.x, FastAPI, SQLAlchemy 2 (async), asyncpg, Alembic, PostgreSQL 16, Redis 7, React 18, Vite, @telegram-apps/sdk, TelegramUI, Docker Compose, Nginx, Certbot

---

## File Map

```
moneytalks/
├── docker-compose.yml              # 5 services: app, postgres, redis, nginx, certbot
├── nginx.conf                      # routing: /, /webhook, /api/*, /.well-known/
├── .env.example                    # all required env vars documented
├── .gitignore
│
├── app/                            # Python monolith
│   ├── main.py                     # entrypoint: starts FastAPI + aiogram webhook
│   ├── config.py                   # settings via pydantic-settings
│   │
│   ├── db/
│   │   ├── base.py                 # SQLAlchemy async engine + session factory
│   │   ├── models.py               # ALL ORM models (all tables)
│   │   └── migrations/             # Alembic env + versions
│   │       ├── env.py
│   │       └── versions/
│   │           └── 0001_initial.py # all tables in one migration
│   │
│   ├── api/
│   │   ├── app.py                  # FastAPI instance, routers mounted
│   │   ├── auth.py                 # initData HMAC-SHA256 middleware
│   │   ├── deps.py                 # get_current_user, get_db dependencies
│   │   └── routers/
│   │       └── health.py           # GET /api/health → {"status": "ok"}
│   │
│   └── bot/
│       ├── bot.py                  # aiogram Bot + Dispatcher setup
│       ├── middlewares/
│       │   └── auth.py             # whitelist middleware for bot
│       └── handlers/
│           └── start.py            # /start handler
│
├── frontend/
│   ├── Dockerfile                  # multi-stage: node:20 build → nginx:alpine serve
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx                # React entry, init Telegram SDK
│       ├── App.tsx                 # 5-tab navigation shell (empty tab pages)
│       └── pages/
│           ├── Dashboard.tsx       # placeholder
│           ├── Budget.tsx          # placeholder
│           ├── Piggy.tsx           # placeholder
│           ├── Loans.tsx           # placeholder
│           └── History.tsx         # placeholder
│
└── tests/
    ├── conftest.py                 # pytest fixtures: test DB, test client
    ├── test_auth.py                # initData validation tests
    └── test_health.py              # GET /api/health
```

---

## Task 1: Project Scaffold & Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `app/__init__.py`, `app/config.py`

- [ ] **Step 1.1: Create `app/__init__.py`** (empty file — required for Python package imports)

```bash
touch app/__init__.py
touch app/api/__init__.py
touch app/api/routers/__init__.py
touch app/bot/__init__.py
touch app/bot/handlers/__init__.py
touch app/bot/middlewares/__init__.py
touch app/db/__init__.py
touch tests/__init__.py
```

- [ ] **Step 1.3: Create `.env.example`**

```env
# Telegram
BOT_TOKEN=your_bot_token_here
ILYA_TG_ID=123456789
ALENA_TG_ID=987654321
WEBHOOK_URL=https://yourdomain.com/webhook

# Database
POSTGRES_USER=moneytalks
POSTGRES_PASSWORD=changeme
POSTGRES_DB=moneytalks
DATABASE_URL=postgresql+asyncpg://moneytalks:changeme@postgres:5432/moneytalks

# Redis
REDIS_URL=redis://redis:6379/0

# App
SECRET_KEY=changeme-at-least-32-chars
DEBUG=false
DEBUG_TRIGGER_SCHEDULER=
```

- [ ] **Step 1.2: Create `.gitignore`**

```gitignore
.env
__pycache__/
*.pyc
.venv/
node_modules/
dist/
.superpowers/
*.egg-info/
.pytest_cache/
```

- [ ] **Step 1.3: Create `docker-compose.yml`**

```yaml
version: "3.9"

services:
  app:
    build: ./app
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped
    networks: [internal]

  postgres:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [internal]

  redis:
    image: redis:7-alpine
    networks: [internal]

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_conf:/etc/letsencrypt:ro
    depends_on: [app]
    networks: [internal]

  certbot:
    image: certbot/certbot
    volumes:
      - certbot_www:/var/www/certbot
      - certbot_conf:/etc/letsencrypt
    entrypoint: >
      sh -c "trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot --quiet; sleep 12h & wait $!; done"

volumes:
  postgres_data:
  certbot_www:
  certbot_conf:

networks:
  internal:
```

- [ ] **Step 1.4: Create `nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # React static
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Bot webhook
    location /webhook {
        proxy_pass http://app:8000/webhook;
        proxy_set_header Host $host;
    }

    # REST API
    location /api/ {
        proxy_pass http://app:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 1.5: Create `app/config.py`**

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    bot_token: str
    ilya_tg_id: int
    alena_tg_id: int
    webhook_url: str

    database_url: str
    redis_url: str

    secret_key: str
    debug: bool = False
    debug_trigger_scheduler: str = ""

    @property
    def allowed_user_ids(self) -> set[int]:
        return {self.ilya_tg_id, self.alena_tg_id}

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 1.6: Create `app/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "main"]
```

- [ ] **Step 1.7: Create `app/requirements.txt`**

```
aiogram==3.13.1
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.13.3
pydantic-settings==2.5.2
redis[hiredis]==5.1.1
apscheduler==3.10.4
httpx==0.27.2
```

- [ ] **Step 1.8: Commit**

```bash
git init
git add .
git commit -m "chore: project scaffold, docker-compose, nginx, config"
```

---

## Task 2: Database Models & Alembic Migration

**Files:**
- Create: `app/db/base.py`
- Create: `app/db/models.py`
- Create: `app/db/migrations/env.py`
- Create: `app/db/migrations/versions/0001_initial.py`

- [ ] **Step 2.1: Create `app/db/base.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 2.2: Create `app/db/models.py`**

```python
from datetime import datetime, date
from sqlalchemy import (
    Integer, String, Boolean, Numeric, Date, DateTime,
    ForeignKey, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BudgetPeriod(Base):
    __tablename__ = "budget_periods"
    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int]
    month: Mapped[int]
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    emoji: Mapped[str] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BudgetLimit(Base):
    __tablename__ = "budget_limits"
    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("budget_periods.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    limit_amount: Mapped[float] = mapped_column(Numeric(12, 2))


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PiggyBank(Base):
    __tablename__ = "piggy_banks"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    current_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PiggyContribution(Base):
    __tablename__ = "piggy_contributions"
    id: Mapped[int] = mapped_column(primary_key=True)
    piggy_bank_id: Mapped[int] = mapped_column(ForeignKey("piggy_banks.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Loan(Base):
    __tablename__ = "loans"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    bank: Mapped[str | None] = mapped_column(String(100), nullable=True)
    original_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    remaining_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 2))  # % годовых
    monthly_payment: Mapped[float] = mapped_column(Numeric(12, 2))
    next_payment_date: Mapped[date] = mapped_column(Date)
    payment_type: Mapped[str] = mapped_column(String(20), default="annuity")  # annuity | differentiated
    start_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoanPayment(Base):
    __tablename__ = "loan_payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2.3: Initialize Alembic**

```bash
cd app
alembic init db/migrations
```

Edit `app/db/migrations/env.py` — set `target_metadata`:

```python
# In env.py, replace the metadata import section with:
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from app.db.base import Base
from app.db import models  # noqa: F401 — import all models

target_metadata = Base.metadata

# Also set sqlalchemy.url from config:
from app.config import get_settings
config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("+asyncpg", "+psycopg2"))
```

- [ ] **Step 2.4: Generate initial migration**

```bash
alembic revision --autogenerate -m "initial"
```

Review the generated file — verify all 9 tables are present.

- [ ] **Step 2.5: Write test for models existence**

`tests/test_models.py`:
```python
import pytest
from app.db.models import (
    User, BudgetPeriod, Category, BudgetLimit,
    Transaction, PiggyBank, PiggyContribution, Loan, LoanPayment
)

def test_all_models_importable():
    """Smoke test — all ORM models can be imported."""
    assert User.__tablename__ == "users"
    assert BudgetPeriod.__tablename__ == "budget_periods"
    assert Category.__tablename__ == "categories"
    assert Transaction.__tablename__ == "transactions"
    assert Loan.__tablename__ == "loans"
```

- [ ] **Step 2.6: Run test**

```bash
cd app && python -m pytest tests/test_models.py -v
```

Expected: 1 PASSED

- [ ] **Step 2.7: Commit**

```bash
git add app/db/ tests/test_models.py
git commit -m "feat: database models and alembic migration (all 9 tables)"
```

---

## Task 3: FastAPI App + Health Endpoint + initData Auth

**Files:**
- Create: `app/api/app.py`
- Create: `app/api/auth.py`
- Create: `app/api/deps.py`
- Create: `app/api/routers/health.py`
- Create: `tests/conftest.py`
- Create: `tests/test_auth.py`
- Create: `tests/test_health.py`

- [ ] **Step 3.1: Write failing auth tests**

`tests/test_auth.py`:
```python
import hashlib, hmac, time, json, urllib.parse
import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from app.config import get_settings

settings = get_settings()

def make_init_data(user_id: int, bot_token: str, age_seconds: int = 0) -> str:
    """Generate a valid Telegram initData string."""
    auth_date = int(time.time()) - age_seconds
    user_json = json.dumps({"id": user_id, "first_name": "Test"})
    data_check = f"auth_date={auth_date}\nuser={user_json}"
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
```

- [ ] **Step 3.2: Run tests — verify they FAIL**

```bash
python -m pytest tests/test_auth.py -v
```

Expected: ImportError or 4 FAILED (app doesn't exist yet)

- [ ] **Step 3.3: Create `app/api/auth.py`**

```python
import hashlib, hmac, time, json, urllib.parse
from fastapi import Request, HTTPException
from app.config import get_settings

settings = get_settings()
MAX_AGE_SECONDS = 3600  # 1 hour


def validate_init_data(init_data: str) -> dict:
    """Validate Telegram initData HMAC. Returns parsed user dict or raises HTTPException."""
    params = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing hash")

    auth_date = int(params.get("auth_date", 0))
    if time.time() - auth_date > MAX_AGE_SECONDS:
        raise HTTPException(status_code=401, detail="initData expired")

    data_check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid signature")

    user = json.loads(params.get("user", "{}"))
    if user.get("id") not in settings.allowed_user_ids:
        raise HTTPException(status_code=403, detail="User not allowed")

    return user


async def get_tg_user(request: Request) -> dict:
    init_data = request.headers.get("X-Telegram-Init-Data")
    if not init_data:
        raise HTTPException(status_code=401, detail="Missing X-Telegram-Init-Data header")
    return validate_init_data(init_data)
```

- [ ] **Step 3.4: Create `app/api/routers/health.py`**

```python
from fastapi import APIRouter, Depends
from app.api.auth import get_tg_user

router = APIRouter()


@router.get("/health")
async def health(user: dict = Depends(get_tg_user)):
    return {"status": "ok", "user_id": user["id"]}
```

- [ ] **Step 3.5: Create `app/api/app.py`**

```python
from fastapi import FastAPI
from app.api.routers.health import router as health_router

app = FastAPI(title="MoneyTalks API")
app.include_router(health_router, prefix="/api")
```

- [ ] **Step 3.6: Create `tests/conftest.py`**

```python
import pytest
import os

# Use test env values if .env not present
os.environ.setdefault("BOT_TOKEN", "test_token:ABC")
os.environ.setdefault("ILYA_TG_ID", "111")
os.environ.setdefault("ALENA_TG_ID", "222")
os.environ.setdefault("WEBHOOK_URL", "https://example.com/webhook")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-minimum!")
```

- [ ] **Step 3.7: Run auth tests — verify they PASS**

```bash
python -m pytest tests/test_auth.py -v
```

Expected: 4 PASSED

- [ ] **Step 3.8: Write and run health test**

`tests/test_health.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from tests.test_auth import make_init_data
from app.api.app import app
from app.config import get_settings

settings = get_settings()


@pytest.mark.asyncio
async def test_health_returns_ok():
    init_data = make_init_data(settings.ilya_tg_id, settings.bot_token)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health", headers={"X-Telegram-Init-Data": init_data})
    assert resp.json() == {"status": "ok", "user_id": settings.ilya_tg_id}
```

```bash
python -m pytest tests/test_health.py -v
```

Expected: 1 PASSED

- [ ] **Step 3.9: Commit**

```bash
git add app/api/ tests/
git commit -m "feat: FastAPI app with initData HMAC auth and /api/health"
```

---

## Task 4: aiogram Bot Setup + Whitelist Middleware + /start

**Files:**
- Create: `app/bot/bot.py`
- Create: `app/bot/middlewares/auth.py`
- Create: `app/bot/handlers/start.py`
- Create: `tests/test_bot_auth.py`

- [ ] **Step 4.1: Write failing bot auth test**

`tests/test_bot_auth.py`:
```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.bot.middlewares.auth import WhitelistMiddleware
from app.config import get_settings

settings = get_settings()


@pytest.mark.asyncio
async def test_allowed_user_passes():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock(return_value="ok")
    event = MagicMock()
    event.from_user.id = settings.ilya_tg_id
    result = await middleware(handler, event, {})
    handler.assert_called_once()


@pytest.mark.asyncio
async def test_unknown_user_blocked():
    middleware = WhitelistMiddleware(settings.allowed_user_ids)
    handler = AsyncMock()
    event = MagicMock()
    event.from_user.id = 99999999
    result = await middleware(handler, event, {})
    handler.assert_not_called()
```

- [ ] **Step 4.2: Run — verify FAIL**

```bash
python -m pytest tests/test_bot_auth.py -v
```

Expected: ImportError

- [ ] **Step 4.3: Create `app/bot/middlewares/auth.py`**

```python
from typing import Callable, Awaitable, Any
from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Message, CallbackQuery


class WhitelistMiddleware(BaseMiddleware):
    def __init__(self, allowed_ids: set[int]):
        self.allowed_ids = allowed_ids

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict], Awaitable[Any]],
        event: TelegramObject,
        data: dict,
    ) -> Any:
        user = None
        if isinstance(event, Message):
            user = event.from_user
        elif isinstance(event, CallbackQuery):
            user = event.from_user

        if user and user.id not in self.allowed_ids:
            if isinstance(event, Message):
                await event.answer("⛔ Нет доступа.")
            return None

        return await handler(event, data)
```

- [ ] **Step 4.4: Run bot auth tests — verify PASS**

```bash
python -m pytest tests/test_bot_auth.py -v
```

Expected: 2 PASSED

- [ ] **Step 4.5: Create `app/bot/handlers/start.py`**

```python
from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    name = message.from_user.first_name
    await message.answer(
        f"👋 Привет, {name}!\n\n"
        "Я веду семейный бюджет для Ильи и Алёны.\n\n"
        "Команды:\n"
        "/add — добавить трату\n"
        "/budget — остаток по категориям\n"
        "/report — отчёт за период\n"
        "/piggy — копилки\n"
        "/debt — кредиты"
    )
```

- [ ] **Step 4.6: Create `app/bot/bot.py`**

```python
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from app.config import get_settings
from app.bot.middlewares.auth import WhitelistMiddleware
from app.bot.handlers.start import router as start_router

settings = get_settings()


def create_bot() -> Bot:
    return Bot(token=settings.bot_token, parse_mode=ParseMode.HTML)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.message.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.callback_query.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.include_router(start_router)
    return dp
```

- [ ] **Step 4.7: Commit**

```bash
git add app/bot/ tests/test_bot_auth.py
git commit -m "feat: aiogram bot with whitelist middleware and /start handler"
```

---

## Task 5: App Entrypoint (Bot + API Together)

**Files:**
- Create: `app/main.py`

- [ ] **Step 5.1: Create `app/main.py`**

```python
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.api.app import app as fastapi_app
from app.bot.bot import create_bot, create_dispatcher
from app.config import get_settings
from app.db.models import Base  # noqa: F401

settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (Alembic handles production migrations; this covers dev)
    # In prod: run `alembic upgrade head` before starting
    bot = create_bot()
    dp = create_dispatcher()

    await bot.set_webhook(settings.webhook_url)
    logger.info(f"Webhook set to {settings.webhook_url}")

    app.state.bot = bot
    app.state.dp = dp

    yield

    await bot.delete_webhook()
    await bot.session.close()


# Mount webhook handler onto FastAPI
from aiogram import Bot, Dispatcher


async def webhook_handler(request: Request) -> Response:
    import json
    from aiogram.types import Update
    from aiogram import Bot, Dispatcher
    body = await request.body()
    update = Update.model_validate(json.loads(body))
    bot: Bot = request.app.state.bot
    dp: Dispatcher = request.app.state.dp
    await dp.feed_update(bot, update)
    return Response()


fastapi_app.router.lifespan_context = lifespan
fastapi_app.add_api_route("/webhook", webhook_handler, methods=["POST"])
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run("main:fastapi_app", host="0.0.0.0", port=8000, reload=settings.debug)
```

- [ ] **Step 5.2: Smoke test — run locally**

```bash
# Copy .env.example to .env and fill in BOT_TOKEN, ILYA_TG_ID, ALENA_TG_ID
# For local test, set WEBHOOK_URL to a temporary ngrok URL
cd app
python -m main
```

Expected: `INFO: Started server process`, no errors at startup

- [ ] **Step 5.3: Commit**

```bash
git add app/main.py
git commit -m "feat: unified entrypoint — FastAPI + aiogram webhook in one process"
```

---

## Task 6: React Frontend Shell

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/pages/` (5 placeholder pages)
- Create: `frontend/Dockerfile`

- [ ] **Step 6.1: Create `frontend/package.json`**

```json
{
  "name": "moneytalks-frontend",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@telegram-apps/sdk": "^2.6.1",
    "@telegram-apps/telegram-ui": "^2.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

- [ ] **Step 6.2: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 6.3: Create `frontend/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { init, miniApp, viewport } from '@telegram-apps/sdk'
import { AppRoot } from '@telegram-apps/telegram-ui'
import '@telegram-apps/telegram-ui/dist/styles.css'
import App from './App'

// Initialize Telegram Mini App SDK
try {
  init()
  miniApp.mount()
  viewport.mount()
} catch {
  // Running outside Telegram (dev mode)
  console.warn('Running outside Telegram environment')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot>
      <App />
    </AppRoot>
  </React.StrictMode>
)
```

- [ ] **Step 6.4: Create `frontend/src/App.tsx`**

```typescript
import React, { useState } from 'react'
import { Tabbar } from '@telegram-apps/telegram-ui'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Piggy from './pages/Piggy'
import Loans from './pages/Loans'
import History from './pages/History'

type Tab = 'dashboard' | 'budget' | 'piggy' | 'loans' | 'history'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Главная', icon: '🏠' },
  { id: 'budget', label: 'Бюджет', icon: '📊' },
  { id: 'piggy', label: 'Копилки', icon: '🐷' },
  { id: 'loans', label: 'Кредиты', icon: '💳' },
  { id: 'history', label: 'История', icon: '📋' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'budget': return <Budget />
      case 'piggy': return <Piggy />
      case 'loans': return <Loans />
      case 'history': return <History />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </div>
      <Tabbar>
        {TABS.map(tab => (
          <Tabbar.Item
            key={tab.id}
            text={tab.label}
            selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
          </Tabbar.Item>
        ))}
      </Tabbar>
    </div>
  )
}
```

- [ ] **Step 6.5: Create placeholder pages**

Create each of these files with identical structure:

`frontend/src/pages/Dashboard.tsx`:
```typescript
export default function Dashboard() {
  return <div style={{ padding: 16 }}><h2>🏠 Главная</h2><p>Coming soon...</p></div>
}
```

Repeat for `Budget.tsx`, `Piggy.tsx`, `Loans.tsx`, `History.tsx` with matching emoji/name.

- [ ] **Step 6.6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MoneyTalks</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6.7: Create `frontend/Dockerfile`**

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Stage 2: serve via nginx (files copied to volume used by main nginx container)
FROM alpine:3
COPY --from=builder /app/dist /dist
# This image is used as a build artifact source; files are copied to nginx volume
CMD ["sh", "-c", "cp -r /dist/. /output/"]
```

**Note:** In production, run `npm run build` locally or in CI and copy `dist/` to the nginx container's static volume. Alternatively mount the dist folder directly in docker-compose.

- [ ] **Step 6.8: Install deps and run locally**

```bash
cd frontend
npm install
npm run dev
```

Expected: Vite dev server starts, opens browser with 5-tab app shell.

- [ ] **Step 6.9: Commit**

```bash
git add frontend/
git commit -m "feat: React frontend shell with 5-tab navigation"
```

---

## Task 7: Seed Default Categories

**Files:**
- Create: `app/db/seed.py`

- [ ] **Step 7.1: Create `app/db/seed.py`**

```python
"""Run once after first migration to populate default categories."""
import asyncio
from app.db.base import AsyncSessionLocal
from app.db.models import Category

DEFAULT_CATEGORIES = [
    ("🛒", "Продукты"),
    ("☕", "Кафе / рестораны"),
    ("🚗", "Транспорт"),
    ("🎭", "Развлечения"),
    ("🍺", "Пиво"),
    ("💊", "Здоровье"),
    ("👗", "Одежда"),
    ("🏠", "Дом / ЖКХ"),
    ("📱", "Связь / подписки"),
    ("🎁", "Подарки"),
]


async def seed():
    async with AsyncSessionLocal() as session:
        for emoji, name in DEFAULT_CATEGORIES:
            session.add(Category(name=name, emoji=emoji))
        await session.commit()
    print(f"Seeded {len(DEFAULT_CATEGORIES)} categories.")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 7.2: Run seed (against local dev DB)**

```bash
cd app
alembic upgrade head
python -m db.seed
```

Expected: `Seeded 10 categories.`

- [ ] **Step 7.3: Commit**

```bash
git add app/db/seed.py
git commit -m "feat: seed script for default categories"
```

---

## Verification Checklist

- [ ] `docker-compose up` — all 5 containers start without errors
- [ ] `alembic upgrade head` — all 9 tables created in PostgreSQL
- [ ] Send `/start` to bot → bot responds with welcome message
- [ ] Non-whitelisted user sends `/start` → bot replies "⛔ Нет доступа."
- [ ] `GET /api/health` with valid initData → `{"status": "ok", "user_id": ...}`
- [ ] `GET /api/health` with expired initData → 401
- [ ] `GET /api/health` with wrong user → 403
- [ ] Open Mini App URL in Telegram → 5-tab shell loads, tabs switch
- [ ] `python -m pytest tests/ -v` → all tests pass
