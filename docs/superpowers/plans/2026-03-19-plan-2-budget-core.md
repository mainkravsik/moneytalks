# MoneyTalks — Plan 2: Budget Core (Categories + Transactions + History)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core budget loop — adding expenses via bot and Mini App, viewing category envelopes with progress bars, browsing transaction history, and the `safe_to_spend` dashboard number.

**Architecture:** FastAPI routers for `/api/budget`, `/api/transactions`, `/api/categories`. Bot handlers for `/add` (inline keyboard flow) and `/budget`. React pages `Budget.tsx` and `Dashboard.tsx` consume the API, display envelope cards, and support adding transactions via modal. Budget periods are 10th–9th (salary-aligned).

**Tech Stack:** Python/FastAPI/SQLAlchemy (existing), React/TelegramUI (existing), Zustand for frontend state, axios for API calls.

**Prerequisite:** Plan 1 complete — DB schema, auth middleware, and project structure all in place.

---

## File Map

```
app/
├── api/
│   ├── routers/
│   │   ├── budget.py          # GET /api/budget/current, PATCH /api/budget/limits
│   │   ├── categories.py      # GET/POST/DELETE /api/categories
│   │   └── transactions.py    # POST/GET/PATCH/DELETE /api/transactions
│   └── schemas/
│       ├── budget.py          # BudgetCurrentResponse, LimitUpdate
│       ├── category.py        # CategoryOut, CategoryCreate
│       └── transaction.py     # TransactionOut, TransactionCreate, TransactionUpdate
├── services/
│   ├── period.py              # get_current_period(), get_or_create_period()
│   ├── budget.py              # safe_to_spend(), get_budget_current()
│   └── cache.py               # Redis safe_to_spend cache (TTL 60s)
├── bot/
│   └── handlers/
│       ├── add.py             # /add command + inline category keyboard FSM
│       └── budget.py          # /budget command → text summary

frontend/src/
├── api/
│   ├── client.ts              # axios instance with initData header
│   ├── budget.ts              # API calls for budget module
│   └── transactions.ts        # API calls for transactions
├── store/
│   └── budget.ts              # Zustand store: period, categories, limits, transactions
├── pages/
│   ├── Dashboard.tsx          # safe_to_spend + top-3 + summary cards (REPLACE placeholder)
│   └── Budget.tsx             # envelope cards + add modal + settings (REPLACE placeholder)
├── components/
│   ├── CategoryCard.tsx       # single envelope card with progress bar
│   ├── AddTransactionModal.tsx # bottom sheet: category picker + amount + comment
│   └── SafeToSpendBadge.tsx   # colored number component

tests/
├── test_period.py             # get_current_period() and get_or_create_period()
├── test_budget_service.py     # safe_to_spend() calculation
├── test_budget_api.py         # GET /api/budget/current
├── test_categories_api.py     # CRUD /api/categories
└── test_transactions_api.py   # CRUD /api/transactions
```

---

## Task 1: Budget Period Service

**Files:**
- Create: `app/services/period.py`
- Create: `tests/test_period.py`

- [ ] **Step 1.1: Write failing tests**

`tests/test_period.py`:
```python
from datetime import date
import pytest
from app.services.period import get_period_bounds, find_period_for_date

def test_period_bounds_march():
    """Period starting March 10 ends April 9."""
    start, end = get_period_bounds(2026, 3)
    assert start == date(2026, 3, 10)
    assert end == date(2026, 4, 9)

def test_period_bounds_december():
    """Period starting December 10 ends January 9 next year."""
    start, end = get_period_bounds(2026, 12)
    assert start == date(2026, 12, 10)
    assert end == date(2027, 1, 9)

def test_find_period_before_10th():
    """Date of March 5 belongs to February period (10 Feb – 9 Mar)."""
    year, month = find_period_for_date(date(2026, 3, 5))
    assert (year, month) == (2026, 2)

def test_find_period_on_10th():
    """Date of March 10 starts a new period — belongs to March."""
    year, month = find_period_for_date(date(2026, 3, 10))
    assert (year, month) == (2026, 3)

def test_find_period_after_10th():
    """Date of March 20 belongs to March period."""
    year, month = find_period_for_date(date(2026, 3, 20))
    assert (year, month) == (2026, 3)

def test_find_period_january_before_10th():
    """Jan 5 belongs to December period of previous year."""
    year, month = find_period_for_date(date(2026, 1, 5))
    assert (year, month) == (2025, 12)
```

- [ ] **Step 1.2: Run — verify FAIL**

```bash
python -m pytest tests/test_period.py -v
```

Expected: ImportError

- [ ] **Step 1.3: Create `app/services/__init__.py` and `app/services/period.py`**

```python
from datetime import date
from calendar import monthrange


def get_period_bounds(year: int, month: int) -> tuple[date, date]:
    """Return (start_date, end_date) for salary-aligned period starting on 10th."""
    start = date(year, month, 10)
    # end = 9th of next month
    if month == 12:
        end = date(year + 1, 1, 9)
    else:
        end = date(year, month + 1, 9)
    return start, end


def find_period_for_date(d: date) -> tuple[int, int]:
    """Return (year, month) of the budget period that contains date d.
    Period starts on 10th: dates 1-9 belong to previous month's period.
    """
    if d.day >= 10:
        return d.year, d.month
    else:
        # belongs to previous month's period
        if d.month == 1:
            return d.year - 1, 12
        else:
            return d.year, d.month - 1
```

- [ ] **Step 1.4: Run — verify PASS**

```bash
python -m pytest tests/test_period.py -v
```

Expected: 6 PASSED

- [ ] **Step 1.5: Create `app/services/period_db.py`** (DB operations for periods)

```python
from datetime import date, datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import BudgetPeriod, BudgetLimit
from app.services.period import find_period_for_date, get_period_bounds


async def get_current_period(db: AsyncSession) -> BudgetPeriod | None:
    today = date.today()
    year, month = find_period_for_date(today)
    result = await db.execute(
        select(BudgetPeriod).where(
            BudgetPeriod.year == year,
            BudgetPeriod.month == month,
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_period(db: AsyncSession) -> BudgetPeriod:
    """Get current period or create it (copying limits from previous period)."""
    period = await get_current_period(db)
    if period:
        return period

    today = date.today()
    year, month = find_period_for_date(today)
    start, end = get_period_bounds(year, month)

    new_period = BudgetPeriod(year=year, month=month, start_date=start, end_date=end)
    db.add(new_period)
    await db.flush()  # get new_period.id

    # Copy limits from previous period
    prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
    prev = await db.execute(
        select(BudgetPeriod).where(
            BudgetPeriod.year == prev_year,
            BudgetPeriod.month == prev_month,
        )
    )
    prev_period = prev.scalar_one_or_none()
    if prev_period:
        limits = await db.execute(
            select(BudgetLimit).where(BudgetLimit.period_id == prev_period.id)
        )
        for limit in limits.scalars():
            db.add(BudgetLimit(
                period_id=new_period.id,
                category_id=limit.category_id,
                limit_amount=limit.limit_amount,
            ))

    await db.commit()
    await db.refresh(new_period)
    return new_period
```

- [ ] **Step 1.6: Commit**

```bash
git add app/services/ tests/test_period.py
git commit -m "feat: budget period service with salary-aligned 10th-9th periods"
```

---

## Task 2: Categories API

**Files:**
- Create: `app/api/schemas/category.py`
- Create: `app/api/routers/categories.py`
- Create: `tests/test_categories_api.py`

- [ ] **Step 2.1: Write failing tests**

`tests/test_categories_api.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings
settings = get_settings()


@pytest.fixture
def auth_headers():
    return {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}


@pytest.mark.asyncio
async def test_get_categories_returns_list(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/categories", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_category(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/categories", json={"name": "Тест", "emoji": "🧪"}, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Тест"
    assert data["emoji"] == "🧪"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_delete_category(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create first
        create = await client.post("/api/categories", json={"name": "Удалить", "emoji": "🗑"}, headers=auth_headers)
        cat_id = create.json()["id"]
        # Delete
        resp = await client.delete(f"/api/categories/{cat_id}", headers=auth_headers)
    assert resp.status_code == 204
```

- [ ] **Step 2.2: Run — verify FAIL**

```bash
python -m pytest tests/test_categories_api.py -v
```

Expected: 3 FAILED (routers not mounted)

- [ ] **Step 2.3: Create `app/api/schemas/category.py`**

```python
from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    emoji: str


class CategoryOut(BaseModel):
    id: int
    name: str
    emoji: str
    is_active: bool

    model_config = {"from_attributes": True}
```

- [ ] **Step 2.4: Create `app/api/routers/categories.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.category import CategoryCreate, CategoryOut
from app.db.base import get_db
from app.db.models import Category

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Category).where(Category.is_active == True))
    return result.scalars().all()


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    cat = Category(name=body.name, emoji=body.emoji)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.is_active = False
    await db.commit()
```

- [ ] **Step 2.5: Mount router in `app/api/app.py`**

```python
from app.api.routers.health import router as health_router
from app.api.routers.categories import router as categories_router

app = FastAPI(title="MoneyTalks API")
app.include_router(health_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
```

- [ ] **Step 2.6: Run tests — verify PASS**

Note: tests use an in-memory/test DB via conftest. If tests require a real DB, add an async test DB fixture in `conftest.py`:

```python
# Add to tests/conftest.py
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.base import Base
from app.api.app import app
from app.db.base import get_db

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(autouse=True)
async def override_db():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async def _get_test_db():
        async with session_factory() as session:
            yield session
    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

Add `aiosqlite` to `requirements.txt` (test dependency).

```bash
python -m pytest tests/test_categories_api.py -v
```

Expected: 3 PASSED

- [ ] **Step 2.7: Commit**

```bash
git add app/api/schemas/ app/api/routers/categories.py app/api/app.py tests/
git commit -m "feat: categories CRUD API"
```

---

## Task 3: Transactions API

**Files:**
- Create: `app/api/schemas/transaction.py`
- Create: `app/api/routers/transactions.py`
- Create: `tests/test_transactions_api.py`

- [ ] **Step 3.1: Write failing tests**

`tests/test_transactions_api.py`:
```python
import pytest
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
            "category_id": cat_id, "amount": 500.0, "comment": "Пятёрочка"
        }, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 500.0
    assert data["is_deleted"] is False


@pytest.mark.asyncio
async def test_list_transactions_current_period():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        cat = await c.post("/api/categories", json={"name": "Еда2", "emoji": "🛒"}, headers=auth)
        cat_id = cat.json()["id"]
        await c.post("/api/transactions", json={"category_id": cat_id, "amount": 100.0}, headers=auth)
        resp = await c.get("/api/transactions", headers=auth)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_soft_delete_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        cat = await c.post("/api/categories", json={"name": "Еда3", "emoji": "🛒"}, headers=auth)
        cat_id = cat.json()["id"]
        tx = await c.post("/api/transactions", json={"category_id": cat_id, "amount": 200.0}, headers=auth)
        tx_id = tx.json()["id"]
        del_resp = await c.delete(f"/api/transactions/{tx_id}", headers=auth)
        list_resp = await c.get("/api/transactions", headers=auth)
    assert del_resp.status_code == 204
    ids = [t["id"] for t in list_resp.json()]
    assert tx_id not in ids
```

- [ ] **Step 3.2: Run — verify FAIL**

```bash
python -m pytest tests/test_transactions_api.py -v
```

Expected: 3 FAILED

- [ ] **Step 3.3: Create `app/api/schemas/transaction.py`**

```python
from datetime import datetime
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    category_id: int
    amount: float
    comment: str | None = None


class TransactionUpdate(BaseModel):
    amount: float | None = None
    comment: str | None = None
    category_id: int | None = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    category_id: int
    amount: float
    comment: str | None
    is_deleted: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 3.4: Create `app/api/routers/transactions.py`**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut
from app.db.base import get_db
from app.db.models import Transaction, User
from app.services.period_db import get_or_create_period
from app.services.period import find_period_for_date
from datetime import date

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _get_or_create_user(tg_user: dict, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.telegram_id == tg_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        user = User(telegram_id=tg_user["id"], name=tg_user.get("first_name", "User"))
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("", response_model=TransactionOut, status_code=201)
async def add_transaction(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    tg_user: dict = Depends(get_tg_user),
):
    user = await _get_or_create_user(tg_user, db)
    await get_or_create_period(db)  # ensure period exists
    tx = Transaction(user_id=user.id, category_id=body.category_id,
                     amount=body.amount, comment=body.comment)
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    # TODO: invalidate Redis cache here (Plan 2 Task 4)
    return tx


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    tg_user: dict = Depends(get_tg_user),
    category_id: int | None = None,
    user_id: int | None = None,
):
    from app.services.period_db import get_current_period
    period = await get_current_period(db)
    if not period:
        return []

    q = select(Transaction).where(
        Transaction.is_deleted == False,
        Transaction.created_at >= datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc),
        Transaction.created_at < datetime.combine(period.end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc),
    )
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if user_id:
        result_user = await db.execute(select(User).where(User.telegram_id == user_id))
        u = result_user.scalar_one_or_none()
        if u:
            q = q.where(Transaction.user_id == u.id)

    result = await db.execute(q.order_by(Transaction.created_at.desc()))
    return result.scalars().all()


@router.patch("/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: int,
    body: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.is_deleted:
        raise HTTPException(404, "Transaction not found")
    if body.amount is not None:
        tx.amount = body.amount
    if body.comment is not None:
        tx.comment = body.comment
    if body.category_id is not None:
        tx.category_id = body.category_id
    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: int,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    tx.is_deleted = True
    await db.commit()
```

- [ ] **Step 3.5: Mount router in `app/api/app.py`**

Add alongside existing routers:
```python
from app.api.routers.transactions import router as transactions_router
app.include_router(transactions_router, prefix="/api")
```

- [ ] **Step 3.6: Run tests — verify PASS**

```bash
python -m pytest tests/test_transactions_api.py -v
```

Expected: 3 PASSED

- [ ] **Step 3.7: Commit**

```bash
git add app/api/routers/transactions.py app/api/schemas/transaction.py app/api/app.py tests/
git commit -m "feat: transactions CRUD API with period-scoped listing"
```

---

## Task 4: Budget Current API + safe_to_spend + Redis Cache

**Files:**
- Create: `app/services/cache.py`
- Create: `app/services/budget.py`
- Create: `app/api/schemas/budget.py`
- Create: `app/api/routers/budget.py`
- Create: `tests/test_budget_service.py`
- Create: `tests/test_budget_api.py`

- [ ] **Step 4.1: Write failing service tests**

`tests/test_budget_service.py`:
```python
import pytest
from app.services.budget import calculate_safe_to_spend

def test_safe_to_spend_basic():
    """sum(limits) - sum(transactions) - unpaid loans."""
    result = calculate_safe_to_spend(
        total_limits=50000.0,
        total_spent=20000.0,
        unpaid_loan_payments=5000.0,
    )
    assert result == 25000.0

def test_safe_to_spend_can_be_negative():
    """Overspending is represented as negative number."""
    result = calculate_safe_to_spend(
        total_limits=10000.0,
        total_spent=12000.0,
        unpaid_loan_payments=0.0,
    )
    assert result == -2000.0
```

- [ ] **Step 4.2: Run — verify FAIL**

```bash
python -m pytest tests/test_budget_service.py -v
```

Expected: ImportError

- [ ] **Step 4.3: Create `app/services/budget.py`**

```python
def calculate_safe_to_spend(
    total_limits: float,
    total_spent: float,
    unpaid_loan_payments: float,
) -> float:
    return total_limits - total_spent - unpaid_loan_payments
```

- [ ] **Step 4.4: Run service tests — verify PASS**

```bash
python -m pytest tests/test_budget_service.py -v
```

Expected: 2 PASSED

- [ ] **Step 4.5: Create `app/services/cache.py`**

```python
import json
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
    r = get_redis()
    val = await r.get(SAFE_TO_SPEND_KEY)
    return float(val) if val is not None else None


async def set_cached_safe_to_spend(value: float) -> None:
    r = get_redis()
    await r.setex(SAFE_TO_SPEND_KEY, SAFE_TO_SPEND_TTL, str(value))


async def invalidate_safe_to_spend() -> None:
    r = get_redis()
    await r.delete(SAFE_TO_SPEND_KEY)
```

- [ ] **Step 4.6: Create `app/api/schemas/budget.py`**

```python
from pydantic import BaseModel
from app.api.schemas.category import CategoryOut


class CategoryBudget(BaseModel):
    category: CategoryOut
    limit: float
    spent: float
    remaining: float
    percent_used: float  # 0.0–1.0+


class LimitUpdate(BaseModel):
    category_id: int
    limit_amount: float


class BudgetCurrentResponse(BaseModel):
    period_year: int
    period_month: int
    start_date: str
    end_date: str
    total_limit: float
    total_spent: float
    safe_to_spend: float
    categories: list[CategoryBudget]
```

- [ ] **Step 4.7: Create `app/api/routers/budget.py`**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.budget import BudgetCurrentResponse, CategoryBudget, LimitUpdate
from app.api.schemas.category import CategoryOut
from app.db.base import get_db
from app.db.models import BudgetLimit, Category, Transaction, Loan, LoanPayment
from app.services.period_db import get_or_create_period
from app.services.budget import calculate_safe_to_spend
from app.services.cache import get_cached_safe_to_spend, set_cached_safe_to_spend

router = APIRouter(prefix="/budget", tags=["budget"])


@router.get("/current", response_model=BudgetCurrentResponse)
async def get_budget_current(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    period = await get_or_create_period(db)

    # Limits
    limits_q = await db.execute(
        select(BudgetLimit, Category)
        .join(Category, BudgetLimit.category_id == Category.id)
        .where(BudgetLimit.period_id == period.id, Category.is_active == True)
    )
    limits_rows = limits_q.all()
    limits_map = {row.BudgetLimit.category_id: row.BudgetLimit.limit_amount for row in limits_rows}

    # Spent per category this period
    period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    period_end = datetime.combine(period.end_date, datetime.min.time()).replace(tzinfo=timezone.utc)

    spent_q = await db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount).label("total"))
        .where(
            Transaction.is_deleted == False,
            Transaction.created_at >= period_start,
            Transaction.created_at < period_end,
        )
        .group_by(Transaction.category_id)
    )
    spent_map = {row.category_id: float(row.total) for row in spent_q}

    # Unpaid loans this period
    paid_loan_ids_q = await db.execute(
        select(LoanPayment.loan_id)
        .where(LoanPayment.paid_at >= period_start)
        .distinct()
    )
    paid_loan_ids = {row[0] for row in paid_loan_ids_q}

    unpaid_loans_q = await db.execute(
        select(func.sum(Loan.monthly_payment))
        .where(Loan.is_active == True, ~Loan.id.in_(paid_loan_ids))
    )
    unpaid_loans = float(unpaid_loans_q.scalar() or 0)

    # Build response
    categories = []
    total_limit = 0.0
    total_spent = 0.0

    for row in limits_rows:
        cat = row.Category
        limit = float(row.BudgetLimit.limit_amount)
        spent = spent_map.get(cat.id, 0.0)
        total_limit += limit
        total_spent += spent
        categories.append(CategoryBudget(
            category=CategoryOut.model_validate(cat),
            limit=limit,
            spent=spent,
            remaining=limit - spent,
            percent_used=spent / limit if limit > 0 else 0.0,
        ))

    # Also add spent for categories without limits
    for cat_id, spent in spent_map.items():
        if cat_id not in limits_map:
            total_spent += spent

    cached = await get_cached_safe_to_spend()
    if cached is None:
        safe = calculate_safe_to_spend(total_limit, total_spent, unpaid_loans)
        await set_cached_safe_to_spend(safe)
    else:
        safe = cached

    return BudgetCurrentResponse(
        period_year=period.year,
        period_month=period.month,
        start_date=str(period.start_date),
        end_date=str(period.end_date),
        total_limit=total_limit,
        total_spent=total_spent,
        safe_to_spend=safe,
        categories=sorted(categories, key=lambda c: c.percent_used, reverse=True),
    )


@router.patch("/limits", status_code=200)
async def update_limits(
    body: list[LimitUpdate],
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_tg_user),
):
    period = await get_or_create_period(db)
    for item in body:
        result = await db.execute(
            select(BudgetLimit).where(
                BudgetLimit.period_id == period.id,
                BudgetLimit.category_id == item.category_id,
            )
        )
        limit = result.scalar_one_or_none()
        if limit:
            limit.limit_amount = item.limit_amount
        else:
            db.add(BudgetLimit(
                period_id=period.id,
                category_id=item.category_id,
                limit_amount=item.limit_amount,
            ))
    await db.commit()
    return {"updated": len(body)}
```

- [ ] **Step 4.8: Mount budget router in `app/api/app.py`**

```python
from app.api.routers.budget import router as budget_router
app.include_router(budget_router, prefix="/api")
```

- [ ] **Step 4.9: Add cache invalidation to `transactions.py`**

In `add_transaction` and `update_transaction` and `delete_transaction`, add after `await db.commit()`:

```python
from app.services.cache import invalidate_safe_to_spend
await invalidate_safe_to_spend()
```

- [ ] **Step 4.10: Write and run budget API test**

`tests/test_budget_api.py`:
```python
import pytest
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


@pytest.mark.asyncio
async def test_budget_reflects_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        cat = await c.post("/api/categories", json={"name": "Тест", "emoji": "🧪"}, headers=auth)
        cat_id = cat.json()["id"]
        await c.patch("/api/budget/limits", json=[{"category_id": cat_id, "limit_amount": 5000}], headers=auth)
        await c.post("/api/transactions", json={"category_id": cat_id, "amount": 1000}, headers=auth)
        resp = await c.get("/api/budget/current", headers=auth)
    data = resp.json()
    cat_data = next(c for c in data["categories"] if c["category"]["id"] == cat_id)
    assert cat_data["spent"] == 1000.0
    assert cat_data["remaining"] == 4000.0
```

```bash
python -m pytest tests/test_budget_api.py -v
```

Expected: 2 PASSED

- [ ] **Step 4.11: Commit**

```bash
git add app/services/ app/api/routers/budget.py app/api/schemas/budget.py app/api/app.py tests/
git commit -m "feat: budget/current API with safe_to_spend and Redis cache"
```

---

## Task 5: Bot — /add Handler (FSM) and /budget Command

**Files:**
- Create: `app/bot/handlers/add.py`
- Create: `app/bot/handlers/budget_cmd.py`

- [ ] **Step 5.1: Create `app/bot/handlers/add.py`**

```python
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import Category, User, Transaction
from app.services.period_db import get_or_create_period
from app.services.cache import invalidate_safe_to_spend

router = Router()


class AddTx(StatesGroup):
    choosing_category = State()
    entering_amount = State()


async def _get_user(telegram_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()
        if not user:
            user = User(telegram_id=telegram_id, name="User")
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user


@router.message(Command("add"))
async def cmd_add(message: Message, state: FSMContext):
    """Start add flow: show category keyboard or parse inline args."""
    # Check for inline format: /add 500 категория
    args = message.text.split(maxsplit=2)[1:]
    if len(args) >= 2:
        try:
            amount = float(args[0])
            category_name = args[1].lower()
        except ValueError:
            await message.answer("❌ Формат: /add <сумма> <категория>\nНапример: /add 500 продукты")
            return

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Category).where(
                    Category.name.ilike(f"%{category_name}%"),
                    Category.is_active == True,
                )
            )
            cat = result.scalars().first()
            if not cat:
                await message.answer(f"❌ Категория '{category_name}' не найдена. Используй кнопки:")
                # Fall through to keyboard
            else:
                user = await _get_user(message.from_user.id)
                await get_or_create_period(db)
                db.add(Transaction(user_id=user.id, category_id=cat.id, amount=amount))
                await db.commit()
                await invalidate_safe_to_spend()
                await message.answer(
                    f"✅ Записал: ₽{amount:.0f} · {cat.emoji} {cat.name} · {message.from_user.first_name}"
                )
                return

    # Show category keyboard
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Category).where(Category.is_active == True))
        categories = result.scalars().all()

    buttons = [
        [InlineKeyboardButton(text=f"{c.emoji} {c.name}", callback_data=f"add_cat:{c.id}")]
        for c in categories
    ]
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    await message.answer("Выбери категорию:", reply_markup=keyboard)
    await state.set_state(AddTx.choosing_category)


@router.callback_query(F.data.startswith("add_cat:"), AddTx.choosing_category)
async def on_category_chosen(cb: CallbackQuery, state: FSMContext):
    cat_id = int(cb.data.split(":")[1])
    await state.update_data(category_id=cat_id)
    await cb.message.edit_text("Введи сумму (например: 450):")
    await state.set_state(AddTx.entering_amount)
    await cb.answer()


@router.message(AddTx.entering_amount)
async def on_amount_entered(message: Message, state: FSMContext):
    try:
        amount = float(message.text.replace(",", "."))
    except ValueError:
        await message.answer("❌ Введи число, например: 450")
        return

    data = await state.get_data()
    cat_id = data["category_id"]

    async with AsyncSessionLocal() as db:
        cat_result = await db.execute(select(Category).where(Category.id == cat_id))
        cat = cat_result.scalar_one()
        user = await _get_user(message.from_user.id)
        await get_or_create_period(db)
        db.add(Transaction(user_id=user.id, category_id=cat_id, amount=amount))
        await db.commit()
        await invalidate_safe_to_spend()

    await state.clear()
    await message.answer(
        f"✅ Записал: ₽{amount:.0f} · {cat.emoji} {cat.name} · {message.from_user.first_name}"
    )
```

- [ ] **Step 5.2: Create `app/bot/handlers/budget_cmd.py`**

```python
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select, func
from datetime import datetime, timezone
from app.db.base import AsyncSessionLocal
from app.db.models import BudgetLimit, Category, Transaction
from app.services.period_db import get_current_period

router = Router()


@router.message(Command("budget"))
async def cmd_budget(message: Message):
    async with AsyncSessionLocal() as db:
        period = await get_current_period(db)
        if not period:
            await message.answer("📭 Бюджет ещё не настроен. Открой мини-апп.")
            return

        limits_q = await db.execute(
            select(BudgetLimit, Category)
            .join(Category, BudgetLimit.category_id == Category.id)
            .where(BudgetLimit.period_id == period.id, Category.is_active == True)
        )
        limits_rows = limits_q.all()

        period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        period_end = datetime.combine(period.end_date, datetime.min.time()).replace(tzinfo=timezone.utc)

        spent_q = await db.execute(
            select(Transaction.category_id, func.sum(Transaction.amount).label("t"))
            .where(
                Transaction.is_deleted == False,
                Transaction.created_at >= period_start,
                Transaction.created_at < period_end,
            )
            .group_by(Transaction.category_id)
        )
        spent_map = {row.category_id: float(row.t) for row in spent_q}

    lines = [f"📊 Бюджет {period.start_date} – {period.end_date}\n"]
    for row in limits_rows:
        cat = row.Category
        limit = float(row.BudgetLimit.limit_amount)
        spent = spent_map.get(cat.id, 0.0)
        pct = int(spent / limit * 100) if limit > 0 else 0
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        status = "⚠️ " if spent > limit else ""
        lines.append(f"{status}{cat.emoji} {cat.name}\n{bar} {spent:.0f} / {limit:.0f} ₽")

    await message.answer("\n\n".join(lines))
```

- [ ] **Step 5.3: Register handlers in `app/bot/bot.py`**

```python
from app.bot.handlers.add import router as add_router
from app.bot.handlers.budget_cmd import router as budget_router

def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.message.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.callback_query.middleware(WhitelistMiddleware(settings.allowed_user_ids))
    dp.include_router(start_router)
    dp.include_router(add_router)
    dp.include_router(budget_router)
    return dp
```

- [ ] **Step 5.4: Add FSM storage to bot dispatcher**

The FSM needs a storage backend. Use Redis:

```python
# In app/bot/bot.py, update create_dispatcher():
from aiogram.fsm.storage.redis import RedisStorage
from app.config import get_settings

settings = get_settings()

def create_dispatcher() -> Dispatcher:
    storage = RedisStorage.from_url(settings.redis_url)
    dp = Dispatcher(storage=storage)
    # ... rest unchanged
```

- [ ] **Step 5.5: Manual test**

```bash
# Start the app locally with a real bot token and ngrok webhook
# Send /add to the bot → category keyboard appears
# Tap a category → bot asks for amount
# Enter 500 → bot confirms "✅ Записал: ₽500 · ..."
# Send /add 300 продукты → bot confirms directly
# Send /budget → bot shows text summary with progress bars
```

- [ ] **Step 5.6: Commit**

```bash
git add app/bot/handlers/ app/bot/bot.py
git commit -m "feat: bot /add FSM handler and /budget text command"
```

---

## Task 6: React — Dashboard and Budget Pages

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/budget.ts`
- Create: `frontend/src/store/budget.ts`
- Create: `frontend/src/components/CategoryCard.tsx`
- Create: `frontend/src/components/AddTransactionModal.tsx`
- Create: `frontend/src/components/SafeToSpendBadge.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/Budget.tsx`

- [ ] **Step 6.1: Create `frontend/src/api/client.ts`**

```typescript
import axios from 'axios'
import { retrieveLaunchParams } from '@telegram-apps/sdk'

function getInitData(): string {
  try {
    const { initDataRaw } = retrieveLaunchParams()
    return initDataRaw || ''
  } catch {
    // Dev mode outside Telegram
    return ''
  }
}

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use(config => {
  config.headers['X-Telegram-Init-Data'] = getInitData()
  return config
})
```

- [ ] **Step 6.2: Create `frontend/src/api/budget.ts`**

```typescript
import { api } from './client'

export interface CategoryBudget {
  category: { id: number; name: string; emoji: string }
  limit: number
  spent: number
  remaining: number
  percent_used: number
}

export interface BudgetCurrent {
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  total_limit: number
  total_spent: number
  safe_to_spend: number
  categories: CategoryBudget[]
}

export const fetchBudgetCurrent = () =>
  api.get<BudgetCurrent>('/budget/current').then(r => r.data)

export const addTransaction = (data: {
  category_id: number
  amount: number
  comment?: string
}) => api.post('/transactions', data)

export const updateLimits = (updates: { category_id: number; limit_amount: number }[]) =>
  api.patch('/budget/limits', updates)
```

- [ ] **Step 6.3: Create `frontend/src/store/budget.ts`**

```typescript
import { create } from 'zustand'
import { BudgetCurrent, fetchBudgetCurrent } from '../api/budget'

interface BudgetStore {
  data: BudgetCurrent | null
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
}

export const useBudgetStore = create<BudgetStore>(set => ({
  data: null,
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await fetchBudgetCurrent()
      set({ data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },
}))
```

- [ ] **Step 6.4: Create `frontend/src/components/SafeToSpendBadge.tsx`**

```typescript
interface Props { amount: number; total: number }

export default function SafeToSpendBadge({ amount, total }: Props) {
  const pct = total > 0 ? amount / total : 0
  const color = pct > 0.3 ? '#4CAF50' : pct > 0.1 ? '#FF9800' : '#F44336'
  return (
    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>
        Можно потратить
      </div>
      <div style={{ fontSize: 36, fontWeight: 'bold', color }}>
        ₽ {amount.toLocaleString('ru')}
      </div>
      <div style={{ fontSize: 11, opacity: 0.5 }}>
        из ₽ {total.toLocaleString('ru')} бюджета
      </div>
    </div>
  )
}
```

- [ ] **Step 6.5: Create `frontend/src/components/CategoryCard.tsx`**

```typescript
import { CategoryBudget } from '../api/budget'

interface Props {
  data: CategoryBudget
  onClick?: () => void
}

export default function CategoryCard({ data, onClick }: Props) {
  const pct = Math.min(data.percent_used, 1)
  const barColor = data.percent_used < 0.7 ? '#4CAF50'
    : data.percent_used < 1 ? '#FF9800'
    : '#F44336'
  const isOver = data.spent > data.limit

  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${isOver ? 'rgba(244,67,54,0.4)' : 'rgba(128,128,128,0.2)'}`,
        borderRadius: 10,
        padding: 12,
        background: isOver ? 'rgba(244,67,54,0.05)' : undefined,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{data.category.emoji} {data.category.name}</span>
        <span style={{ fontSize: 12, color: barColor, fontWeight: 'bold' }}>
          ₽{data.spent.toLocaleString('ru')} / ₽{data.limit.toLocaleString('ru')}
        </span>
      </div>
      <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 8 }}>
        <div style={{ background: barColor, width: `${Math.min(pct * 100, 100)}%`, height: 8, borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
        {isOver
          ? `⚠️ Превышено на ₽${(data.spent - data.limit).toLocaleString('ru')}`
          : `Осталось ₽${data.remaining.toLocaleString('ru')}`}
      </div>
    </div>
  )
}
```

- [ ] **Step 6.6: Create `frontend/src/components/AddTransactionModal.tsx`**

```typescript
import { useState } from 'react'
import { CategoryBudget, addTransaction } from '../api/budget'

interface Props {
  categories: CategoryBudget[]
  onClose: () => void
  onSuccess: () => void
}

export default function AddTransactionModal({ categories, onClose, onSuccess }: Props) {
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!categoryId || !amount) return
    setLoading(true)
    try {
      await addTransaction({ category_id: categoryId, amount: parseFloat(amount), comment: comment || undefined })
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--tg-theme-bg-color, #fff)',
      borderRadius: '16px 16px 0 0',
      padding: 20, zIndex: 100,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
    }}>
      <h3 style={{ margin: '0 0 16px' }}>Добавить трату</h3>
      <select
        style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)' }}
        value={categoryId ?? ''}
        onChange={e => setCategoryId(Number(e.target.value))}
      >
        <option value="">— Выбери категорию —</option>
        {categories.map(c => (
          <option key={c.category.id} value={c.category.id}>
            {c.category.emoji} {c.category.name}
          </option>
        ))}
      </select>
      <input
        type="number" placeholder="Сумма, ₽"
        value={amount} onChange={e => setAmount(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', boxSizing: 'border-box' }}
      />
      <input
        type="text" placeholder="Комментарий (необязательно)"
        value={comment} onChange={e => setComment(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 16, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent' }}>
          Отмена
        </button>
        <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontWeight: 'bold' }}>
          {loading ? '...' : 'Записать'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.7: Update `frontend/src/pages/Dashboard.tsx`**

```typescript
import { useEffect } from 'react'
import { useBudgetStore } from '../store/budget'
import SafeToSpendBadge from '../components/SafeToSpendBadge'
import CategoryCard from '../components/CategoryCard'

export default function Dashboard() {
  const { data, loading, fetch } = useBudgetStore()

  useEffect(() => { fetch() }, [])

  if (loading) return <div style={{ padding: 16 }}>Загрузка...</div>
  if (!data) return <div style={{ padding: 16 }}>Нет данных</div>

  const top3 = data.categories.slice(0, 3)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SafeToSpendBadge amount={data.safe_to_spend} total={data.total_limit} />
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase' }}>Топ категории</div>
      {top3.map(cat => <CategoryCard key={cat.category.id} data={cat} />)}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 10, textAlign: 'center', fontSize: 12 }}>
          <div>🐷 Копилки</div>
          <div style={{ fontWeight: 'bold', marginTop: 4 }}>—</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 10, textAlign: 'center', fontSize: 12 }}>
          <div>💳 Долг</div>
          <div style={{ fontWeight: 'bold', marginTop: 4 }}>—</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.8: Update `frontend/src/pages/Budget.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useBudgetStore } from '../store/budget'
import CategoryCard from '../components/CategoryCard'
import AddTransactionModal from '../components/AddTransactionModal'

export default function Budget() {
  const { data, loading, fetch } = useBudgetStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetch() }, [])

  if (loading) return <div style={{ padding: 16 }}>Загрузка...</div>
  if (!data) return <div style={{ padding: 16 }}>Нет данных</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{data.start_date} – {data.end_date}</span>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 13 }}
        >
          + Добавить трату
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.categories.map(cat => (
          <CategoryCard key={cat.category.id} data={cat} />
        ))}
        {data.categories.length === 0 && (
          <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>
            Категории не настроены. Открой настройки бюджета.
          </div>
        )}
      </div>
      {showModal && (
        <AddTransactionModal
          categories={data.categories}
          onClose={() => setShowModal(false)}
          onSuccess={() => fetch()}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6.9: Install Zustand**

```bash
cd frontend
npm install zustand axios
```

- [ ] **Step 6.10: Manual UI test**

```bash
cd frontend && npm run dev
# Open http://localhost:5173
# Dashboard shows "Можно потратить" with correct number
# Budget tab shows category envelopes
# Click "+ Добавить трату" → modal opens → submit → list refreshes
```

- [ ] **Step 6.11: Commit**

```bash
git add frontend/src/
git commit -m "feat: Dashboard and Budget pages with safe_to_spend and envelope cards"
```

---

## Verification Checklist

- [ ] All backend tests pass: `python -m pytest tests/ -v` → green
- [ ] `/add` in bot — keyboard flow works end-to-end
- [ ] `/add 500 продукты` — inline format works
- [ ] `/budget` — shows text progress bars
- [ ] `GET /api/budget/current` — returns correct `safe_to_spend`
- [ ] Spend over a category limit → budget card turns red
- [ ] Add transaction via Mini App modal → Dashboard number updates
- [ ] Delete transaction → number recovers
- [ ] Redis cache invalidates on new transaction (verify TTL/miss by checking Redis CLI: `redis-cli GET safe_to_spend`)
