# MoneyTalks — Plan 3: Piggy Banks + Loans + Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement savings goals (piggy banks), loan tracking with Snowball/Avalanche payoff recommendations, extra payment calculator, and APScheduler-based notifications (weekly report, monthly reset, credit reminders, limit exceeded alerts).

**Architecture:** FastAPI routers for `/api/piggy` and `/api/loans`. Payoff algorithm is a pure service function (no DB calls, easily testable). Notifications run via APScheduler with Redis as backend. Dashboard piggy/debt summary cards are wired up. History page is implemented.

**Tech Stack:** Same as Plans 1-2. APScheduler 3.x with AsyncIOScheduler + RedisJobStore.

**Prerequisite:** Plans 1 and 2 complete.

---

## File Map

```
app/
├── api/
│   ├── routers/
│   │   ├── piggy.py               # GET/POST/PATCH/DELETE /api/piggy, POST /api/piggy/{id}/contribute
│   │   ├── loans.py               # GET /api/loans/payoff (FIRST), GET/POST/PATCH/DELETE, POST payment
│   │   └── history.py             # GET /api/history (alias of transactions with period filter)
│   └── schemas/
│       ├── piggy.py               # PiggyOut, PiggyCreate, PiggyUpdate, ContributeBody
│       └── loan.py                # LoanOut, LoanCreate, LoanUpdate, PayoffResult
├── services/
│   ├── payoff.py                  # calculate_payoff(loans, extra) → PayoffResult (pure function)
│   └── notifications.py           # send_weekly_report(), send_monthly_reset(), send_loan_reminder()
├── bot/
│   ├── scheduler.py               # APScheduler setup, job registration
│   └── handlers/
│       ├── piggy_cmd.py           # /piggy command
│       └── debt_cmd.py            # /debt command

frontend/src/
├── api/
│   ├── piggy.ts
│   └── loans.ts
├── store/
│   ├── piggy.ts                   # Zustand piggy store
│   └── loans.ts                   # Zustand loans store
├── pages/
│   ├── Piggy.tsx                  # REPLACE placeholder
│   ├── Loans.tsx                  # REPLACE placeholder
│   └── History.tsx                # REPLACE placeholder
└── components/
    ├── PiggyCard.tsx
    ├── LoanCard.tsx
    ├── PayoffComparison.tsx        # Snowball vs Avalanche side-by-side
    └── ExtraPaymentSlider.tsx      # slider + real-time payoff delta

tests/
├── test_payoff.py                 # pure function tests for both strategies
├── test_piggy_api.py
└── test_loans_api.py
```

---

## Task 1: Piggy Banks API

**Files:**
- Create: `app/api/schemas/piggy.py`
- Create: `app/api/routers/piggy.py`
- Create: `tests/test_piggy_api.py`

- [ ] **Step 1.1: Write failing tests**

`tests/test_piggy_api.py`:
```python
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
    assert data["current_amount"] == 0.0


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
    assert updated["current_amount"] == 5000.0


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
```

- [ ] **Step 1.2: Run — verify FAIL**

```bash
python -m pytest tests/test_piggy_api.py -v
```

Expected: 3 FAILED

- [ ] **Step 1.3: Create `app/api/schemas/piggy.py`**

```python
from datetime import date
from pydantic import BaseModel


class PiggyCreate(BaseModel):
    name: str
    target_amount: float | None = None
    target_date: date | None = None


class PiggyUpdate(BaseModel):
    name: str | None = None
    target_amount: float | None = None
    target_date: date | None = None


class ContributeBody(BaseModel):
    amount: float


class PiggyOut(BaseModel):
    id: int
    name: str
    target_amount: float | None
    current_amount: float
    target_date: date | None
    is_active: bool

    model_config = {"from_attributes": True}
```

- [ ] **Step 1.4: Create `app/api/routers/piggy.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.piggy import PiggyCreate, PiggyUpdate, PiggyOut, ContributeBody
from app.db.base import get_db
from app.db.models import PiggyBank, PiggyContribution, User

router = APIRouter(prefix="/piggy", tags=["piggy"])


async def _get_user_from_db(tg_user: dict, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.telegram_id == tg_user["id"]))
    return result.scalar_one_or_none()


@router.get("", response_model=list[PiggyOut])
async def list_piggies(db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.is_active == True))
    return result.scalars().all()


@router.post("", response_model=PiggyOut, status_code=201)
async def create_piggy(body: PiggyCreate, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    pig = PiggyBank(name=body.name, target_amount=body.target_amount,
                    target_date=body.target_date, current_amount=0.0)
    db.add(pig)
    await db.commit()
    await db.refresh(pig)
    return pig


@router.patch("/{pig_id}", response_model=PiggyOut)
async def update_piggy(pig_id: int, body: PiggyUpdate, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.id == pig_id, PiggyBank.is_active == True))
    pig = result.scalar_one_or_none()
    if not pig:
        raise HTTPException(404, "Piggy bank not found")
    if body.name is not None:
        pig.name = body.name
    if body.target_amount is not None:
        pig.target_amount = body.target_amount
    if body.target_date is not None:
        pig.target_date = body.target_date
    await db.commit()
    await db.refresh(pig)
    return pig


@router.post("/{pig_id}/contribute", response_model=PiggyOut)
async def contribute(pig_id: int, body: ContributeBody, db: AsyncSession = Depends(get_db), tg_user: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.id == pig_id, PiggyBank.is_active == True))
    pig = result.scalar_one_or_none()
    if not pig:
        raise HTTPException(404, "Piggy bank not found")
    user = await _get_user_from_db(tg_user, db)
    db.add(PiggyContribution(piggy_bank_id=pig_id, user_id=user.id if user else 1, amount=body.amount))
    pig.current_amount = float(pig.current_amount) + body.amount
    await db.commit()
    await db.refresh(pig)
    return pig


@router.delete("/{pig_id}", status_code=204)
async def delete_piggy(pig_id: int, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(PiggyBank).where(PiggyBank.id == pig_id))
    pig = result.scalar_one_or_none()
    if not pig:
        raise HTTPException(404, "Piggy bank not found")
    pig.is_active = False
    await db.commit()
```

- [ ] **Step 1.5: Mount router in `app/api/app.py`**

```python
from app.api.routers.piggy import router as piggy_router
app.include_router(piggy_router, prefix="/api")
```

- [ ] **Step 1.6: Run tests — verify PASS**

```bash
python -m pytest tests/test_piggy_api.py -v
```

Expected: 3 PASSED

- [ ] **Step 1.7: Commit**

```bash
git add app/api/routers/piggy.py app/api/schemas/piggy.py app/api/app.py tests/
git commit -m "feat: piggy banks CRUD API with contributions"
```

---

## Task 2: Payoff Algorithm (Pure Function)

**Files:**
- Create: `app/services/payoff.py`
- Create: `tests/test_payoff.py`

- [ ] **Step 2.1: Write failing tests**

`tests/test_payoff.py`:
```python
import pytest
from app.services.payoff import LoanInput, calculate_payoff


LOANS = [
    LoanInput(id=1, name="Ипотека", remaining=300000, interest_rate=12.0, monthly_payment=8000),
    LoanInput(id=2, name="Потреб", remaining=50000, interest_rate=24.0, monthly_payment=3000),
]


def test_snowball_pays_smallest_first():
    result = calculate_payoff(LOANS, strategy="snowball", extra=0)
    # Smallest remaining = Потреб (50k) should appear first in order
    assert result.order[0].id == 2


def test_avalanche_pays_highest_rate_first():
    result = calculate_payoff(LOANS, strategy="avalanche", extra=0)
    # Highest rate = Потреб (24%) should appear first
    assert result.order[0].id == 2


def test_extra_payment_reduces_months():
    result_no_extra = calculate_payoff(LOANS, strategy="avalanche", extra=0)
    result_with_extra = calculate_payoff(LOANS, strategy="avalanche", extra=5000)
    assert result_with_extra.months_to_payoff < result_no_extra.months_to_payoff


def test_extra_payment_reduces_interest():
    result_no_extra = calculate_payoff(LOANS, strategy="avalanche", extra=0)
    result_with_extra = calculate_payoff(LOANS, strategy="avalanche", extra=5000)
    assert result_with_extra.total_interest < result_no_extra.total_interest


def test_infinite_loop_guard():
    """monthly_payment <= monthly_interest should raise ValueError."""
    bad_loans = [LoanInput(id=1, name="Bad", remaining=1000000, interest_rate=24.0, monthly_payment=100)]
    with pytest.raises(ValueError, match="monthly_payment"):
        calculate_payoff(bad_loans, strategy="avalanche", extra=0)
```

- [ ] **Step 2.2: Run — verify FAIL**

```bash
python -m pytest tests/test_payoff.py -v
```

Expected: ImportError

- [ ] **Step 2.3: Create `app/services/payoff.py`**

```python
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class LoanInput:
    id: int
    name: str
    remaining: float
    interest_rate: float   # % годовых
    monthly_payment: float


@dataclass
class PayoffOrder:
    id: int
    name: str
    paid_off_in_month: int


@dataclass
class PayoffResult:
    strategy: str
    months_to_payoff: int
    total_interest: float
    total_paid: float
    order: list[PayoffOrder]
    extra: float


def calculate_payoff(
    loans: list[LoanInput],
    strategy: Literal["snowball", "avalanche"],
    extra: float,
) -> PayoffResult:
    """Simulate loan payoff. Raises ValueError if any loan can't be paid off."""
    # Validate: monthly_payment must exceed monthly interest
    for loan in loans:
        monthly_interest = loan.remaining * (loan.interest_rate / 12 / 100)
        if loan.monthly_payment <= monthly_interest:
            raise ValueError(
                f"Loan '{loan.name}': monthly_payment ({loan.monthly_payment}) "
                f"<= monthly interest ({monthly_interest:.2f}). Loan cannot be paid off."
            )

    # Sort by strategy
    if strategy == "snowball":
        sorted_loans = sorted(loans, key=lambda l: l.remaining)
    else:  # avalanche
        sorted_loans = sorted(loans, key=lambda l: l.interest_rate, reverse=True)

    # Simulate month by month
    balances = {l.id: l.remaining for l in loans}
    min_payments = {l.id: l.monthly_payment for l in loans}
    rates = {l.id: l.interest_rate for l in loans}

    total_interest = 0.0
    total_paid = 0.0
    order: list[PayoffOrder] = []
    month = 0
    MAX_MONTHS = 600  # 50 years cap

    while any(b > 0 for b in balances.values()) and month < MAX_MONTHS:
        month += 1
        available_extra = extra

        for loan in sorted_loans:
            lid = loan.id
            if balances[lid] <= 0:
                continue

            monthly_interest = balances[lid] * (rates[lid] / 12 / 100)
            total_interest += monthly_interest

            # Minimum payment
            payment = min(min_payments[lid], balances[lid] + monthly_interest)
            balances[lid] = balances[lid] + monthly_interest - payment
            total_paid += payment

            # Apply extra to the first non-zero loan in priority order
            if available_extra > 0 and balances[lid] > 0:
                extra_applied = min(available_extra, balances[lid])
                balances[lid] -= extra_applied
                total_paid += extra_applied
                available_extra -= extra_applied

            if balances[lid] <= 0.01:
                balances[lid] = 0
                if not any(o.id == lid for o in order):
                    order.append(PayoffOrder(id=lid, name=loan.name, paid_off_in_month=month))

    return PayoffResult(
        strategy=strategy,
        months_to_payoff=month,
        total_interest=round(total_interest, 2),
        total_paid=round(total_paid, 2),
        order=order,
        extra=extra,
    )
```

- [ ] **Step 2.4: Run tests — verify PASS**

```bash
python -m pytest tests/test_payoff.py -v
```

Expected: 5 PASSED

- [ ] **Step 2.5: Commit**

```bash
git add app/services/payoff.py tests/test_payoff.py
git commit -m "feat: Snowball/Avalanche payoff algorithm with extra payment calculator"
```

---

## Task 3: Loans API

**Files:**
- Create: `app/api/schemas/loan.py`
- Create: `app/api/routers/loans.py`
- Create: `tests/test_loans_api.py`

- [ ] **Step 3.1: Write failing tests**

`tests/test_loans_api.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app
from tests.test_auth import make_init_data
from app.config import get_settings
settings = get_settings()

auth = {"X-Telegram-Init-Data": make_init_data(settings.ilya_tg_id, settings.bot_token)}

LOAN_DATA = {
    "name": "Потреб", "bank": "Сбер",
    "original_amount": 100000, "remaining_amount": 80000,
    "interest_rate": 18.0, "monthly_payment": 5000,
    "next_payment_date": "2026-04-10",
    "start_date": "2025-10-10",
}


@pytest.mark.asyncio
async def test_create_loan():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post("/api/loans", json=LOAN_DATA, headers=auth)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Потреб"


@pytest.mark.asyncio
async def test_payoff_calculation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/loans", json=LOAN_DATA, headers=auth)
        resp = await c.get("/api/loans/payoff?extra=0", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert "snowball" in data
    assert "avalanche" in data
    assert data["snowball"]["months_to_payoff"] > 0


@pytest.mark.asyncio
async def test_payoff_with_extra_is_shorter():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/loans", json=LOAN_DATA, headers=auth)
        no_extra = await c.get("/api/loans/payoff?extra=0", headers=auth)
        with_extra = await c.get("/api/loans/payoff?extra=3000", headers=auth)
    assert with_extra.json()["avalanche"]["months_to_payoff"] < no_extra.json()["avalanche"]["months_to_payoff"]


@pytest.mark.asyncio
async def test_record_payment_advances_date():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        loan = await c.post("/api/loans", json=LOAN_DATA, headers=auth)
        loan_id = loan.json()["id"]
        resp = await c.post(f"/api/loans/{loan_id}/payment", json={"amount": 5000}, headers=auth)
        loan_after = (await c.get("/api/loans", headers=auth)).json()
    assert resp.status_code == 200
    updated = next(l for l in loan_after if l["id"] == loan_id)
    # next_payment_date should advance by 1 month
    assert updated["next_payment_date"] == "2026-05-10"
```

- [ ] **Step 3.2: Run — verify FAIL**

```bash
python -m pytest tests/test_loans_api.py -v
```

Expected: 4 FAILED

- [ ] **Step 3.3: Create `app/api/schemas/loan.py`**

```python
from datetime import date, datetime
from pydantic import BaseModel


class LoanCreate(BaseModel):
    name: str
    bank: str | None = None
    original_amount: float
    remaining_amount: float
    interest_rate: float
    monthly_payment: float
    next_payment_date: date
    start_date: date
    payment_type: str = "annuity"


class LoanUpdate(BaseModel):
    name: str | None = None
    bank: str | None = None
    interest_rate: float | None = None
    monthly_payment: float | None = None
    next_payment_date: date | None = None


class LoanPaymentBody(BaseModel):
    amount: float
    paid_at: datetime | None = None


class LoanOut(BaseModel):
    id: int
    name: str
    bank: str | None
    original_amount: float
    remaining_amount: float
    interest_rate: float
    monthly_payment: float
    next_payment_date: date
    start_date: date
    is_active: bool

    model_config = {"from_attributes": True}


class StrategyResult(BaseModel):
    strategy: str
    months_to_payoff: int
    total_interest: float
    total_paid: float
    extra: float


class PayoffResponse(BaseModel):
    snowball: StrategyResult
    avalanche: StrategyResult
    savings_with_avalanche: float  # interest savings vs snowball
```

- [ ] **Step 3.4: Create `app/api/routers/loans.py`**

```python
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.schemas.loan import LoanCreate, LoanUpdate, LoanOut, LoanPaymentBody, PayoffResponse, StrategyResult
from app.db.base import get_db
from app.db.models import Loan, LoanPayment, User
from app.services.payoff import LoanInput, calculate_payoff

router = APIRouter(prefix="/loans", tags=["loans"])

# IMPORTANT: /payoff MUST be declared before /{loan_id} to avoid route collision


@router.get("/payoff", response_model=PayoffResponse)
async def get_payoff(
    extra: float = 0,
    db: AsyncSession = Depends(get_db),
    _u: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Loan).where(Loan.is_active == True))
    loans = result.scalars().all()
    if not loans:
        raise HTTPException(404, "No active loans")

    inputs = [
        LoanInput(
            id=l.id,
            name=l.name,
            remaining=float(l.remaining_amount),
            interest_rate=float(l.interest_rate),
            monthly_payment=float(l.monthly_payment),
        )
        for l in loans
    ]

    try:
        snowball = calculate_payoff(inputs, "snowball", extra)
        avalanche = calculate_payoff(inputs, "avalanche", extra)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return PayoffResponse(
        snowball=StrategyResult(
            strategy="snowball",
            months_to_payoff=snowball.months_to_payoff,
            total_interest=snowball.total_interest,
            total_paid=snowball.total_paid,
            extra=extra,
        ),
        avalanche=StrategyResult(
            strategy="avalanche",
            months_to_payoff=avalanche.months_to_payoff,
            total_interest=avalanche.total_interest,
            total_paid=avalanche.total_paid,
            extra=extra,
        ),
        savings_with_avalanche=round(snowball.total_interest - avalanche.total_interest, 2),
    )


@router.get("", response_model=list[LoanOut])
async def list_loans(db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(Loan).where(Loan.is_active == True))
    return result.scalars().all()


@router.post("", response_model=LoanOut, status_code=201)
async def create_loan(body: LoanCreate, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    loan = Loan(**body.model_dump())
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.patch("/{loan_id}", response_model=LoanOut)
async def update_loan(loan_id: int, body: LoanUpdate, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.is_active == True))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(404)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(loan, field, val)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.post("/{loan_id}/payment", response_model=LoanOut)
async def record_payment(
    loan_id: int,
    body: LoanPaymentBody,
    db: AsyncSession = Depends(get_db),
    tg_user: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.is_active == True))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(404)

    user_result = await db.execute(select(User).where(User.telegram_id == tg_user["id"]))
    user = user_result.scalar_one_or_none()

    paid_at = body.paid_at or datetime.now(timezone.utc)
    db.add(LoanPayment(loan_id=loan_id, user_id=user.id if user else 1, amount=body.amount, paid_at=paid_at))

    loan.remaining_amount = max(0, float(loan.remaining_amount) - body.amount)
    loan.next_payment_date = loan.next_payment_date + relativedelta(months=1)

    if loan.remaining_amount <= 0:
        loan.is_active = False

    await db.commit()
    await db.refresh(loan)
    return loan


@router.delete("/{loan_id}", status_code=204)
async def delete_loan(loan_id: int, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(404)
    loan.is_active = False
    await db.commit()
```

Add `python-dateutil` to `requirements.txt`.

- [ ] **Step 3.5: Mount router in `app/api/app.py`**

```python
from app.api.routers.loans import router as loans_router
app.include_router(loans_router, prefix="/api")
```

- [ ] **Step 3.6: Run tests — verify PASS**

```bash
python -m pytest tests/test_loans_api.py -v
```

Expected: 4 PASSED

- [ ] **Step 3.7: Commit**

```bash
git add app/api/routers/loans.py app/api/schemas/loan.py app/api/app.py requirements.txt tests/
git commit -m "feat: loans CRUD API with payoff calculation and payment tracking"
```

---

## Task 4: Notifications (APScheduler)

**Files:**
- Create: `app/bot/scheduler.py`
- Create: `app/services/notifications.py`

- [ ] **Step 4.1: Create `app/services/notifications.py`**

```python
"""Notification message builders — pure functions, no I/O."""
from datetime import date


def weekly_report_text(
    period_start: date,
    period_end: date,
    total_spent: float,
    total_limit: float,
    top_categories: list[dict],  # [{"emoji": "🛒", "name": "...", "spent": 100}]
) -> str:
    lines = [
        f"📊 <b>Недельный отчёт</b>",
        f"Период: {period_start} – {period_end}",
        f"Потрачено: <b>₽{total_spent:.0f}</b> из ₽{total_limit:.0f}",
        "",
        "Топ трат:",
    ]
    for cat in top_categories[:5]:
        lines.append(f"  {cat['emoji']} {cat['name']}: ₽{cat['spent']:.0f}")
    return "\n".join(lines)


def monthly_reset_text(new_start: date, new_end: date) -> str:
    return (
        f"💰 <b>Зарплата!</b> Новый бюджетный период начался.\n"
        f"{new_start} – {new_end}\n\n"
        f"Бюджет скопирован с прошлого месяца — хочешь изменить лимиты? Открой мини-апп."
    )


def loan_reminder_text(loan_name: str, amount: float, days_left: int) -> str:
    return (
        f"⏰ <b>Напоминание о платеже</b>\n"
        f"Кредит: {loan_name}\n"
        f"Сумма: ₽{amount:.0f}\n"
        f"Осталось дней: {days_left}"
    )


def limit_exceeded_text(category_emoji: str, category_name: str, spent: float, limit: float) -> str:
    over = spent - limit
    return (
        f"⚠️ <b>Лимит превышен!</b>\n"
        f"{category_emoji} {category_name}: потрачено ₽{spent:.0f} из ₽{limit:.0f}\n"
        f"Перерасход: ₽{over:.0f}"
    )
```

- [ ] **Step 4.2: Create `app/bot/scheduler.py`**

```python
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore
from sqlalchemy import select, func
from app.config import get_settings
from app.db.base import AsyncSessionLocal
from app.db.models import (
    BudgetLimit, Category, Transaction, Loan, BudgetPeriod, User
)
from app.services.period_db import get_or_create_period, get_current_period
from app.services.period import get_period_bounds
from app.services.notifications import weekly_report_text, monthly_reset_text, loan_reminder_text

settings = get_settings()
logger = logging.getLogger(__name__)


async def _send_to_all(bot, text: str):
    """Send a message to both Ilya and Alena."""
    for tg_id in settings.allowed_user_ids:
        try:
            await bot.send_message(tg_id, text, parse_mode="HTML")
        except Exception as e:
            logger.error(f"Failed to send to {tg_id}: {e}")


async def job_weekly_report(bot):
    async with AsyncSessionLocal() as db:
        period = await get_current_period(db)
        if not period:
            return

        period_start = datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        period_end = datetime.combine(period.end_date, datetime.min.time()).replace(tzinfo=timezone.utc)

        limits_q = await db.execute(
            select(BudgetLimit, Category)
            .join(Category)
            .where(BudgetLimit.period_id == period.id)
        )
        total_limit = sum(float(r.BudgetLimit.limit_amount) for r in limits_q)

        spent_q = await db.execute(
            select(Category.emoji, Category.name, func.sum(Transaction.amount).label("t"))
            .join(Transaction, Transaction.category_id == Category.id)
            .where(
                Transaction.is_deleted == False,
                Transaction.created_at >= period_start,
                Transaction.created_at < period_end,
            )
            .group_by(Category.id)
            .order_by(func.sum(Transaction.amount).desc())
        )
        rows = spent_q.all()
        total_spent = sum(float(r.t) for r in rows)
        top = [{"emoji": r.emoji, "name": r.name, "spent": float(r.t)} for r in rows]

    text = weekly_report_text(period.start_date, period.end_date, total_spent, total_limit, top)
    await _send_to_all(bot, text)


async def job_monthly_reset(bot):
    async with AsyncSessionLocal() as db:
        period = await get_or_create_period(db)
    text = monthly_reset_text(period.start_date, period.end_date)
    await _send_to_all(bot, text)


async def job_loan_reminders(bot):
    today = datetime.now(timezone.utc).date()
    in_3_days = today + timedelta(days=3)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Loan).where(Loan.is_active == True, Loan.next_payment_date == in_3_days)
        )
        loans = result.scalars().all()

    for loan in loans:
        text = loan_reminder_text(loan.name, float(loan.monthly_payment), 3)
        await _send_to_all(bot, text)


def create_scheduler(bot) -> AsyncIOScheduler:
    from urllib.parse import urlparse
    parsed = urlparse(settings.redis_url)
    jobstores = {"default": RedisJobStore(host=parsed.hostname or "redis", port=parsed.port or 6379)}
    scheduler = AsyncIOScheduler(jobstores=jobstores)

    # Weekly report every Monday at 10:00
    scheduler.add_job(job_weekly_report, "cron", day_of_week="mon", hour=10, minute=0, args=[bot])

    # Monthly reset on 10th at 09:00
    scheduler.add_job(job_monthly_reset, "cron", day=10, hour=9, minute=0, args=[bot])

    # Loan reminders daily at 09:00
    scheduler.add_job(job_loan_reminders, "cron", hour=9, minute=0, args=[bot])

    # Debug: trigger scheduler jobs immediately on startup
    if settings.debug_trigger_scheduler == "weekly":
        scheduler.add_job(job_weekly_report, "date", run_date=datetime.now(timezone.utc), args=[bot])
    elif settings.debug_trigger_scheduler == "monthly":
        scheduler.add_job(job_monthly_reset, "date", run_date=datetime.now(timezone.utc), args=[bot])

    return scheduler
```

- [ ] **Step 4.3: Wire scheduler into `app/main.py` lifespan**

In the `lifespan` context manager in `main.py`, add after `await bot.set_webhook(...)`:

```python
from app.bot.scheduler import create_scheduler
scheduler = create_scheduler(bot)
scheduler.start()
app.state.scheduler = scheduler
```

And in the cleanup section (before `yield` returns):
```python
scheduler.shutdown(wait=False)
```

- [ ] **Step 4.4: Add limit-exceeded check in transactions router**

In `app/api/routers/transactions.py`, after a transaction is created, check if limit is exceeded and notify:

```python
# After db.commit() in add_transaction:
from app.services.notifications import limit_exceeded_text
from app.bot.bot import create_bot
from sqlalchemy import select, func
from app.db.models import BudgetLimit

# Check if limit exceeded for this category
period = await get_or_create_period(db)
limit_q = await db.execute(
    select(BudgetLimit).where(
        BudgetLimit.period_id == period.id,
        BudgetLimit.category_id == body.category_id,
    )
)
budget_limit = limit_q.scalar_one_or_none()
if budget_limit:
    spent_q = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.category_id == body.category_id,
            Transaction.is_deleted == False,
            Transaction.created_at >= datetime.combine(period.start_date, datetime.min.time()).replace(tzinfo=timezone.utc),
        )
    )
    total_spent = float(spent_q.scalar() or 0)
    limit_val = float(budget_limit.limit_amount)
    if total_spent > limit_val:
        cat_q = await db.execute(select(Category).where(Category.id == body.category_id))
        cat = cat_q.scalar_one_or_none()
        if cat:
            bot_instance = create_bot()
            for tg_id in settings.allowed_user_ids:
                try:
                    await bot_instance.send_message(
                        tg_id,
                        limit_exceeded_text(cat.emoji, cat.name, total_spent, limit_val),
                        parse_mode="HTML"
                    )
                except Exception:
                    pass
            await bot_instance.session.close()
```

- [ ] **Step 4.5: Manual test**

```bash
# Set DEBUG_TRIGGER_SCHEDULER=weekly in .env and restart
# App startup → weekly report should arrive immediately in Telegram
# Add a transaction that exceeds a category limit → limit exceeded message arrives
```

- [ ] **Step 4.6: Commit**

```bash
git add app/bot/scheduler.py app/services/notifications.py app/main.py app/api/routers/transactions.py
git commit -m "feat: APScheduler notifications — weekly report, monthly reset, loan reminders, limit exceeded"
```

---

## Task 5: React — Piggy, Loans, and History Pages

**Files:**
- Create: `frontend/src/api/piggy.ts`
- Create: `frontend/src/api/loans.ts`
- Create: `frontend/src/components/PiggyCard.tsx`
- Create: `frontend/src/components/LoanCard.tsx`
- Create: `frontend/src/components/PayoffComparison.tsx`
- Create: `frontend/src/components/ExtraPaymentSlider.tsx`
- Modify: `frontend/src/pages/Piggy.tsx`
- Modify: `frontend/src/pages/Loans.tsx`
- Modify: `frontend/src/pages/History.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx` (wire up piggy/loan summary)

- [ ] **Step 5.1: Create `frontend/src/api/piggy.ts`**

```typescript
import { api } from './client'

export interface Piggy {
  id: number; name: string
  target_amount: number | null
  current_amount: number
  target_date: string | null
  is_active: boolean
}

export const fetchPiggies = () => api.get<Piggy[]>('/piggy').then(r => r.data)
export const createPiggy = (data: { name: string; target_amount?: number; target_date?: string }) =>
  api.post<Piggy>('/piggy', data).then(r => r.data)
export const contributePiggy = (id: number, amount: number) =>
  api.post<Piggy>(`/piggy/${id}/contribute`, { amount }).then(r => r.data)
export const deletePiggy = (id: number) => api.delete(`/piggy/${id}`)
```

- [ ] **Step 5.2: Create `frontend/src/api/loans.ts`**

```typescript
import { api } from './client'

export interface Loan {
  id: number; name: string; bank: string | null
  original_amount: number; remaining_amount: number
  interest_rate: number; monthly_payment: number
  next_payment_date: string; start_date: string; is_active: boolean
}

export interface StrategyResult {
  strategy: string; months_to_payoff: number
  total_interest: number; total_paid: number; extra: number
}

export interface PayoffResponse {
  snowball: StrategyResult; avalanche: StrategyResult
  savings_with_avalanche: number
}

export const fetchLoans = () => api.get<Loan[]>('/loans').then(r => r.data)
export const fetchPayoff = (extra = 0) =>
  api.get<PayoffResponse>(`/loans/payoff?extra=${extra}`).then(r => r.data)
export const recordPayment = (id: number, amount: number) =>
  api.post<Loan>(`/loans/${id}/payment`, { amount }).then(r => r.data)
export const createLoan = (data: Partial<Loan>) => api.post<Loan>('/loans', data).then(r => r.data)
```

- [ ] **Step 5.3: Create `frontend/src/components/PiggyCard.tsx`**

```typescript
import { Piggy, contributePiggy } from '../api/piggy'
import { useState } from 'react'

export default function PiggyCard({ pig, onUpdate }: { pig: Piggy; onUpdate: () => void }) {
  const pct = pig.target_amount ? pig.current_amount / pig.target_amount : 0
  const [amount, setAmount] = useState('')
  const [adding, setAdding] = useState(false)

  const handleContribute = async () => {
    if (!amount) return
    await contributePiggy(pig.id, parseFloat(amount))
    setAmount('')
    setAdding(false)
    onUpdate()
  }

  return (
    <div style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'bold' }}>🐷 {pig.name}</span>
        <span style={{ fontSize: 12, color: '#4CAF50' }}>
          ₽{pig.current_amount.toLocaleString('ru')}
          {pig.target_amount ? ` / ₽${pig.target_amount.toLocaleString('ru')}` : ''}
        </span>
      </div>
      {pig.target_amount && (
        <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, margin: '8px 0' }}>
          <div style={{ background: '#2196F3', width: `${Math.min(pct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
        </div>
      )}
      {pig.target_date && (
        <div style={{ fontSize: 11, opacity: 0.5 }}>Цель: {pig.target_date}</div>
      )}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="number" placeholder="Сумма"
            value={amount} onChange={e => setAmount(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)' }}
          />
          <button onClick={handleContribute} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#4CAF50', color: '#fff' }}>OK</button>
          <button onClick={() => setAdding(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent' }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E3F2FD', color: '#1976D2', fontSize: 12 }}>
          + Пополнить
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5.4: Create `frontend/src/components/ExtraPaymentSlider.tsx`**

```typescript
import { useState, useEffect } from 'react'
import { fetchPayoff, PayoffResponse } from '../api/loans'

export default function ExtraPaymentSlider() {
  const [extra, setExtra] = useState(0)
  const [data, setData] = useState<PayoffResponse | null>(null)

  useEffect(() => {
    fetchPayoff(extra).then(setData).catch(() => setData(null))
  }, [extra])

  if (!data) return null

  return (
    <div style={{ padding: 12, border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>💡 Калькулятор доплаты</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        Если доплачивать <b>₽{extra.toLocaleString('ru')}/мес</b>:
      </div>
      <input
        type="range" min={0} max={50000} step={500}
        value={extra} onChange={e => setExtra(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 12 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(128,128,128,0.08)', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <div style={{ opacity: 0.6 }}>Snowball</div>
          <div><b>{data.snowball.months_to_payoff} мес</b></div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>₽{data.snowball.total_interest.toLocaleString('ru')} переплата</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(76,175,80,0.1)', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <div style={{ opacity: 0.6 }}>Avalanche</div>
          <div><b>{data.avalanche.months_to_payoff} мес</b></div>
          <div style={{ fontSize: 11, color: '#4CAF50' }}>экономия ₽{data.savings_with_avalanche.toLocaleString('ru')}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5.5: Update `frontend/src/pages/Piggy.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { fetchPiggies, Piggy, createPiggy, deletePiggy } from '../api/piggy'
import PiggyCard from '../components/PiggyCard'

export default function PiggyPage() {
  const [piggies, setPiggies] = useState<Piggy[]>([])
  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () => fetchPiggies().then(setPiggies)
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName) return
    await createPiggy({ name: newName, target_amount: newTarget ? parseFloat(newTarget) : undefined })
    setNewName(''); setNewTarget(''); setAdding(false)
    load()
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>🐷 Копилки</h3>
        <button onClick={() => setAdding(true)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 12 }}>
          + Новая
        </button>
      </div>
      {adding && (
        <div style={{ background: 'rgba(128,128,128,0.08)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <input placeholder="Название" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', boxSizing: 'border-box' }} />
          <input placeholder="Цель (₽, необязательно)" type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#4CAF50', color: '#fff' }}>Создать</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent' }}>Отмена</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {piggies.map(pig => <PiggyCard key={pig.id} pig={pig} onUpdate={load} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.6: Update `frontend/src/pages/Loans.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { fetchLoans, Loan, recordPayment } from '../api/loans'
import ExtraPaymentSlider from '../components/ExtraPaymentSlider'

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const load = () => fetchLoans().then(setLoans)
  useEffect(() => { load() }, [])

  const handlePayment = async (loan: Loan) => {
    const amount = prompt(`Платёж по "${loan.name}" (мин. ₽${loan.monthly_payment}):`)
    if (!amount) return
    await recordPayment(loan.id, parseFloat(amount))
    load()
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>💳 Кредиты</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {loans.map(loan => {
          const pct = 1 - loan.remaining_amount / loan.original_amount
          return (
            <div key={loan.id} style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 'bold' }}>{loan.name}</span>
                <span style={{ fontSize: 12 }}>{loan.bank || ''}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                Остаток: <b>₽{loan.remaining_amount.toLocaleString('ru')}</b> · {loan.interest_rate}% годовых
              </div>
              <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 6 }}>
                <div style={{ background: '#4CAF50', width: `${Math.min(pct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
                <span>Платёж: ₽{loan.monthly_payment.toLocaleString('ru')}</span>
                <span>Следующий: {loan.next_payment_date}</span>
              </div>
              <button onClick={() => handlePayment(loan)}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
                ✓ Записать платёж
              </button>
            </div>
          )
        })}
        {loans.length === 0 && <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>Кредитов нет</div>}
      </div>
      {loans.length > 0 && <ExtraPaymentSlider />}
    </div>
  )
}
```

- [ ] **Step 5.7: Update `frontend/src/pages/History.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { api } from '../api/client'

interface Transaction {
  id: number; amount: number; comment: string | null
  category_id: number; created_at: string; is_deleted: boolean
}

export default function HistoryPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const load = () => api.get<Transaction[]>('/transactions').then(r => setTxs(r.data))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    await api.delete(`/transactions/${id}`)
    load()
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>📋 История</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {txs.map(tx => (
          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>₽{tx.amount.toLocaleString('ru')}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(tx.created_at).toLocaleDateString('ru')} · {tx.comment || '—'}
              </div>
            </div>
            <button onClick={() => handleDelete(tx.id)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(244,67,54,0.1)', color: '#F44336', fontSize: 12 }}>
              Удалить
            </button>
          </div>
        ))}
        {txs.length === 0 && <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 40 }}>Нет транзакций в этом периоде</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.8: Update Dashboard piggy/loan summary cards**

In `frontend/src/pages/Dashboard.tsx`, fetch piggy and loan totals and replace the `—` placeholders:

```typescript
// Add to Dashboard.tsx
import { useEffect, useState } from 'react'
import { fetchPiggies } from '../api/piggy'
import { fetchLoans } from '../api/loans'

// Inside Dashboard():
const [piggyTotal, setPiggyTotal] = useState(0)
const [loanTotal, setLoanTotal] = useState(0)

useEffect(() => {
  fetchPiggies().then(pigs => setPiggyTotal(pigs.reduce((s, p) => s + p.current_amount, 0)))
  fetchLoans().then(loans => setLoanTotal(loans.reduce((s, l) => s + l.remaining_amount, 0)))
}, [])

// Replace the summary cards section:
<div style={{ display: 'flex', gap: 8 }}>
  <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 10, textAlign: 'center', fontSize: 12 }}>
    <div>🐷 Копилки</div>
    <div style={{ fontWeight: 'bold', marginTop: 4 }}>₽{piggyTotal.toLocaleString('ru')}</div>
  </div>
  <div style={{ flex: 1, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 10, textAlign: 'center', fontSize: 12 }}>
    <div>💳 Долг</div>
    <div style={{ fontWeight: 'bold', marginTop: 4 }}>₽{loanTotal.toLocaleString('ru')}</div>
  </div>
</div>
```

- [ ] **Step 5.9: Manual UI test**

```bash
cd frontend && npm run dev
# Piggy page: create piggy, contribute, see progress bar update
# Loans page: see loan list, record payment, see date advance
# Slider moves → months_to_payoff updates in real time
# History: see transactions, delete one → disappears
# Dashboard: piggy/loan summary cards show real numbers
```

- [ ] **Step 5.10: Commit**

```bash
git add frontend/src/
git commit -m "feat: Piggy, Loans, History pages — complete Mini App"
```

---

## Task 6: Bot — /piggy and /debt Commands

**Files:**
- Create: `app/bot/handlers/piggy_cmd.py`
- Create: `app/bot/handlers/debt_cmd.py`

- [ ] **Step 6.1: Create `app/bot/handlers/piggy_cmd.py`**

```python
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import PiggyBank

router = Router()


@router.message(Command("piggy"))
async def cmd_piggy(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(PiggyBank).where(PiggyBank.is_active == True))
        piggies = result.scalars().all()

    if not piggies:
        await message.answer("🐷 Копилок пока нет. Создай в мини-апп.")
        return

    lines = ["🐷 <b>Копилки</b>"]
    for pig in piggies:
        current = float(pig.current_amount)
        if pig.target_amount:
            target = float(pig.target_amount)
            pct = int(current / target * 100)
            bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
            lines.append(f"\n{pig.name}\n{bar} ₽{current:.0f} / ₽{target:.0f} ({pct}%)")
        else:
            lines.append(f"\n{pig.name}: ₽{current:.0f}")

    await message.answer("\n".join(lines), parse_mode="HTML")
```

- [ ] **Step 6.2: Create `app/bot/handlers/debt_cmd.py`**

```python
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import Loan

router = Router()


@router.message(Command("debt"))
async def cmd_debt(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Loan).where(Loan.is_active == True))
        loans = result.scalars().all()

    if not loans:
        await message.answer("💳 Кредитов нет. Добавь в мини-апп.")
        return

    total = sum(float(l.remaining_amount) for l in loans)
    lines = [f"💳 <b>Кредиты</b> (итого: ₽{total:.0f})\n"]
    for loan in loans:
        remaining = float(loan.remaining_amount)
        pct = int((1 - remaining / float(loan.original_amount)) * 100)
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        lines.append(
            f"{loan.name}{' · ' + loan.bank if loan.bank else ''}\n"
            f"{bar} ₽{remaining:.0f} · {loan.interest_rate}%\n"
            f"Платёж: ₽{float(loan.monthly_payment):.0f} · след. {loan.next_payment_date}"
        )

    await message.answer("\n\n".join(lines), parse_mode="HTML")
```

- [ ] **Step 6.3: Register handlers in `app/bot/bot.py`**

```python
from app.bot.handlers.piggy_cmd import router as piggy_router
from app.bot.handlers.debt_cmd import router as debt_router

# In create_dispatcher():
dp.include_router(piggy_router)
dp.include_router(debt_router)
```

- [ ] **Step 6.4: Commit**

```bash
git add app/bot/handlers/piggy_cmd.py app/bot/handlers/debt_cmd.py app/bot/bot.py
git commit -m "feat: bot /piggy and /debt commands"
```

---

## Final Verification Checklist

- [ ] All backend tests pass: `python -m pytest tests/ -v` → all green
- [ ] Create a piggy bank in Mini App → `/piggy` shows it in bot
- [ ] Contribute to piggy → balance updates on Dashboard card
- [ ] Add 2 loans via Mini App → `/debt` shows correct summary
- [ ] Open Loans tab → Snowball/Avalanche comparison appears
- [ ] Move extra payment slider → months_to_payoff changes in real time
- [ ] Record a loan payment → `next_payment_date` advances by 1 month
- [ ] `DEBUG_TRIGGER_SCHEDULER=weekly` → weekly report arrives on startup
- [ ] `DEBUG_TRIGGER_SCHEDULER=monthly` → monthly reset + period created
- [ ] Transaction exceeding category limit → bot sends limit exceeded notification
- [ ] History tab → shows all transactions, delete works
- [ ] Dashboard piggy/debt summary cards show real numbers
- [ ] Full flow end-to-end: add transaction in bot → see update in Mini App
