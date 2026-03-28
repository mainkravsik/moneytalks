# Credit Card Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-charge tracking, grace period logic, and payoff calculator for credit cards (СберКарта model).

**Architecture:** New `CardCharge` model tracks individual card charges with auto-computed grace deadlines. New fields on `Loan` model replace `grace_days`/`min_payment` with computed equivalents. New API endpoints for charges, card summary, and card payoff calculator. Frontend gets updated card UI with grace breakdown, charge list, and calculator page.

**Tech Stack:** Python/FastAPI, SQLAlchemy 2.0, Alembic, React/TypeScript, Vite

---

## File Structure

**Create:**
- `app/services/card.py` — grace deadline calculation, min payment calc, interest accrual, payoff simulation
- `app/api/schemas/card_charge.py` — Pydantic schemas for card charges, card summary, card payoff
- `tests/test_card_service.py` — tests for card service logic
- `tests/test_card_charges_api.py` — tests for card charge API endpoints
- `frontend/src/pages/CardDetail.tsx` — card detail page (charges list + calculator)
- `frontend/src/api/card.ts` — API client for card endpoints

**Modify:**
- `app/db/models.py` — add `CardCharge` model, update `Loan` model (new fields, remove old)
- `app/db/migrations/versions/0003_card_charges.py` — new migration
- `app/api/routers/loans.py` — add charge endpoints, card summary, card payoff
- `app/api/schemas/loan.py` — update LoanCreate/LoanUpdate/LoanOut for new fields
- `frontend/src/api/loans.ts` — update Loan interface
- `frontend/src/pages/Loans.tsx` — update card UI, add navigation to detail page
- `frontend/src/App.tsx` — add CardDetail route

---

### Task 1: Card Service — Grace Deadline & Min Payment Logic

**Files:**
- Create: `app/services/card.py`
- Create: `tests/test_card_service.py`

- [ ] **Step 1: Write failing tests for grace deadline calculation**

```python
# tests/test_card_service.py
import os
os.environ.setdefault("BOT_TOKEN", "test_token:ABC")
os.environ.setdefault("ILYA_TG_ID", "111")
os.environ.setdefault("ALENA_TG_ID", "222")
os.environ.setdefault("WEBHOOK_URL", "https://example.com/webhook")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-minimum!")
os.environ.setdefault("WEBHOOK_SECRET", "test-webhook-secret-16c")

from datetime import date
from decimal import Decimal
from app.services.card import compute_grace_deadline, compute_min_payment, compute_monthly_interest


def test_grace_deadline_purchase_january():
    # Purchase in January -> grace deadline is April 30
    result = compute_grace_deadline(date(2026, 1, 15), "purchase", grace_months=3)
    assert result == date(2026, 4, 30)


def test_grace_deadline_purchase_october():
    # Purchase in October -> grace deadline is January 31 (next year)
    result = compute_grace_deadline(date(2026, 10, 5), "purchase", grace_months=3)
    assert result == date(2027, 1, 31)


def test_grace_deadline_purchase_november():
    # Purchase in November -> grace deadline is February 28 (next year)
    result = compute_grace_deadline(date(2026, 11, 20), "purchase", grace_months=3)
    assert result == date(2027, 2, 28)


def test_grace_deadline_transfer_returns_none():
    result = compute_grace_deadline(date(2026, 1, 15), "transfer", grace_months=3)
    assert result is None


def test_grace_deadline_cash_returns_none():
    result = compute_grace_deadline(date(2026, 3, 1), "cash", grace_months=3)
    assert result is None


def test_min_payment_normal():
    # 3% of 338712.06 = 10161.36
    result = compute_min_payment(
        debt=Decimal("338712.06"),
        accrued_interest=Decimal("0"),
        pct=Decimal("0.03"),
        floor=Decimal("150"),
    )
    assert result == Decimal("10161.36")


def test_min_payment_floor():
    # 3% of 4000 = 120 < 150, so floor applies
    result = compute_min_payment(
        debt=Decimal("4000"),
        accrued_interest=Decimal("0"),
        pct=Decimal("0.03"),
        floor=Decimal("150"),
    )
    assert result == Decimal("150")


def test_min_payment_with_interest():
    # 3% of 100000 = 3000 + 500 interest = 3500
    result = compute_min_payment(
        debt=Decimal("100000"),
        accrued_interest=Decimal("500"),
        pct=Decimal("0.03"),
        floor=Decimal("150"),
    )
    assert result == Decimal("3500")


def test_min_payment_zero_debt():
    result = compute_min_payment(
        debt=Decimal("0"),
        accrued_interest=Decimal("0"),
        pct=Decimal("0.03"),
        floor=Decimal("150"),
    )
    assert result == Decimal("0")


def test_monthly_interest():
    # 25.4% annual on 338712.06 for one month
    result = compute_monthly_interest(
        amount=Decimal("338712.06"),
        annual_rate=Decimal("25.4"),
    )
    # 338712.06 * 25.4 / 100 / 12 = 7170.94
    assert result == Decimal("7170.94")


def test_monthly_interest_zero_rate():
    result = compute_monthly_interest(
        amount=Decimal("100000"),
        annual_rate=Decimal("0"),
    )
    assert result == Decimal("0")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_card_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.card'`

- [ ] **Step 3: Implement card service**

```python
# app/services/card.py
import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

TWO_PLACES = Decimal("0.01")


def compute_grace_deadline(charge_date: date, charge_type: str, grace_months: int = 3) -> date | None:
    """Compute grace period deadline for a card charge.

    Purchases: last day of (charge_month + grace_months).
    Transfers/cash: None (interest accrues immediately).
    """
    if charge_type != "purchase":
        return None

    month = charge_date.month + grace_months
    year = charge_date.year
    while month > 12:
        month -= 12
        year += 1

    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, last_day)


def compute_min_payment(
    debt: Decimal,
    accrued_interest: Decimal,
    pct: Decimal = Decimal("0.03"),
    floor: Decimal = Decimal("150"),
) -> Decimal:
    """Compute minimum monthly payment for a credit card.

    Formula: max(debt * pct, floor) + accrued_interest.
    Returns 0 if debt is 0.
    """
    if debt <= 0:
        return Decimal("0")
    base = max((debt * pct).quantize(TWO_PLACES, ROUND_HALF_UP), floor)
    return (base + accrued_interest).quantize(TWO_PLACES, ROUND_HALF_UP)


def compute_monthly_interest(amount: Decimal, annual_rate: Decimal) -> Decimal:
    """Compute one month of interest on a given amount."""
    if annual_rate <= 0 or amount <= 0:
        return Decimal("0")
    return (amount * annual_rate / 100 / 12).quantize(TWO_PLACES, ROUND_HALF_UP)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_card_service.py -v`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/card.py tests/test_card_service.py
git commit -m "feat: add card service — grace deadline, min payment, interest calc"
```

---

### Task 2: Database Model & Migration

**Files:**
- Modify: `app/db/models.py`
- Create: `app/db/migrations/versions/0003_card_charges.py`

- [ ] **Step 1: Update Loan model and add CardCharge model**

In `app/db/models.py`, replace the card-only fields section of `Loan` and add `CardCharge`:

Replace in `Loan` class (lines 96-98):
```python
    # Card-only fields
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    grace_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0 = grace period expired
    min_payment: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
```

With:
```python
    # Card-only fields
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    grace_period_months: Mapped[int | None] = mapped_column(Integer, nullable=True, default=3)
    min_payment_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True, default=Decimal("0.03"))
    min_payment_floor: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True, default=Decimal("150"))
```

Add after `LoanPayment` class:
```python
class CardCharge(Base):
    __tablename__ = "card_charges"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str] = mapped_column(String(200))
    charge_type: Mapped[str] = mapped_column(String(20))  # purchase | transfer | cash
    charge_date: Mapped[date] = mapped_column(Date)
    grace_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Create migration file**

Create `app/db/migrations/versions/0003_card_charges.py`:

```python
"""add card_charges table and update loan card fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create card_charges table
    op.create_table(
        'card_charges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('loan_id', sa.Integer(), sa.ForeignKey('loans.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.String(200), nullable=False),
        sa.Column('charge_type', sa.String(20), nullable=False),
        sa.Column('charge_date', sa.Date(), nullable=False),
        sa.Column('grace_deadline', sa.Date(), nullable=True),
        sa.Column('is_paid', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Add new card fields to loans
    op.add_column('loans', sa.Column('grace_period_months', sa.Integer(), nullable=True))
    op.add_column('loans', sa.Column('min_payment_pct', sa.Numeric(5, 4), nullable=True))
    op.add_column('loans', sa.Column('min_payment_floor', sa.Numeric(12, 2), nullable=True))

    # Migrate existing card data: grace_days -> grace_period_months, min_payment -> min_payment_floor
    op.execute("""
        UPDATE loans
        SET grace_period_months = 3,
            min_payment_pct = 0.03,
            min_payment_floor = COALESCE(min_payment, 150)
        WHERE loan_type = 'card'
    """)

    # Drop old columns
    op.drop_column('loans', 'grace_days')
    op.drop_column('loans', 'min_payment')


def downgrade() -> None:
    op.add_column('loans', sa.Column('grace_days', sa.Integer(), nullable=True))
    op.add_column('loans', sa.Column('min_payment', sa.Numeric(12, 2), nullable=True))

    op.execute("""
        UPDATE loans
        SET grace_days = COALESCE(grace_period_months, 0) * 30,
            min_payment = min_payment_floor
        WHERE loan_type = 'card'
    """)

    op.drop_column('loans', 'grace_period_months')
    op.drop_column('loans', 'min_payment_pct')
    op.drop_column('loans', 'min_payment_floor')
    op.drop_table('card_charges')
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `python -m pytest tests/ -v`
Expected: All existing tests PASS (SQLite creates tables from models, migration not needed for tests)

- [ ] **Step 4: Commit**

```bash
git add app/db/models.py app/db/migrations/versions/0003_card_charges.py
git commit -m "feat: add CardCharge model and migration 0003"
```

---

### Task 3: Schemas for Card Charges

**Files:**
- Create: `app/api/schemas/card_charge.py`
- Modify: `app/api/schemas/loan.py`

- [ ] **Step 1: Create card charge schemas**

```python
# app/api/schemas/card_charge.py
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class CardChargeCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    description: str = Field(min_length=1, max_length=200)
    charge_type: str = Field(pattern="^(purchase|transfer|cash)$")
    charge_date: date


class CardChargeOut(BaseModel):
    id: int
    loan_id: int
    amount: Decimal
    description: str
    charge_type: str
    charge_date: date
    grace_deadline: date | None
    is_paid: bool
    status: str  # "in_grace" | "overdue" | "paid" | "no_grace"

    model_config = {"from_attributes": True}


class GraceBucket(BaseModel):
    deadline: date
    total: Decimal
    is_overdue: bool


class CardSummary(BaseModel):
    total_debt: Decimal
    grace_buckets: list[GraceBucket]
    non_grace_debt: Decimal
    accrued_interest: Decimal
    min_payment: Decimal
    available: Decimal


class CardPayoffMonth(BaseModel):
    month: str
    debt_start: float
    payment: float
    interest: float
    debt_end: float


class CardPayoffResponse(BaseModel):
    months: list[CardPayoffMonth]
    total_months: int
    total_interest: float
    total_paid: float
    recommendations: dict[str, float]  # "zero_interest", "close_in_6", "close_in_12"
```

- [ ] **Step 2: Update loan schemas — replace grace_days/min_payment with new fields**

In `app/api/schemas/loan.py`, update `LoanCreate`:

Replace:
```python
    # card-only fields
    credit_limit: Decimal | None = None
    grace_days: int | None = None
    min_payment: Decimal | None = None
```

With:
```python
    # card-only fields
    credit_limit: Decimal | None = None
    grace_period_months: int | None = 3
    min_payment_pct: Decimal | None = Decimal("0.03")
    min_payment_floor: Decimal | None = Decimal("150")
```

In `LoanUpdate`, replace:
```python
    credit_limit: Decimal | None = None
    grace_days: int | None = None
    min_payment: Decimal | None = None
```

With:
```python
    credit_limit: Decimal | None = None
    grace_period_months: int | None = None
    min_payment_pct: Decimal | None = None
    min_payment_floor: Decimal | None = None
```

In `LoanOut`, replace:
```python
    credit_limit: Decimal | None
    grace_days: int | None
    min_payment: Decimal | None
```

With:
```python
    credit_limit: Decimal | None
    grace_period_months: int | None
    min_payment_pct: Decimal | None
    min_payment_floor: Decimal | None
```

- [ ] **Step 3: Run existing tests**

Run: `python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/schemas/card_charge.py app/api/schemas/loan.py
git commit -m "feat: add card charge schemas, update loan schemas for new card fields"
```

---

### Task 4: Card Charge API Endpoints

**Files:**
- Modify: `app/api/routers/loans.py`
- Create: `tests/test_card_charges_api.py`

- [ ] **Step 1: Write failing tests for card charge endpoints**

```python
# tests/test_card_charges_api.py
from unittest.mock import patch
import pytest
from httpx import AsyncClient, ASGITransport
from app.api.app import app

FAKE_TG_USER = {"id": 111, "first_name": "Test"}


@pytest.fixture
def auth():
    with patch("app.api.routers.loans.get_tg_user", return_value=FAKE_TG_USER):
        yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def card(client, auth):
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
    })
    assert resp.status_code == 201
    return resp.json()


async def test_add_charge_purchase(client, auth, card):
    resp = await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 5000,
        "description": "Groceries",
        "charge_type": "purchase",
        "charge_date": "2026-03-15",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == "5000.00"
    assert data["grace_deadline"] == "2026-06-30"
    assert data["status"] == "in_grace"


async def test_add_charge_transfer_no_grace(client, auth, card):
    resp = await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 10000,
        "description": "Transfer",
        "charge_type": "transfer",
        "charge_date": "2026-03-15",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["grace_deadline"] is None
    assert data["status"] == "no_grace"


async def test_add_charge_updates_remaining(client, auth, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 5000,
        "description": "Test",
        "charge_type": "purchase",
        "charge_date": "2026-03-15",
    })
    resp = await client.get("/api/loans")
    loans = resp.json()
    updated = [l for l in loans if l["id"] == card["id"]][0]
    assert float(updated["remaining_amount"]) == 5000.0


async def test_list_charges(client, auth, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 1000, "description": "A", "charge_type": "purchase", "charge_date": "2026-03-01",
    })
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 2000, "description": "B", "charge_type": "purchase", "charge_date": "2026-03-15",
    })
    resp = await client.get(f"/api/loans/{card['id']}/charges?month=2026-03")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


async def test_delete_charge(client, auth, card):
    resp = await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 3000, "description": "Del", "charge_type": "purchase", "charge_date": "2026-03-10",
    })
    charge_id = resp.json()["id"]
    del_resp = await client.delete(f"/api/loans/{card['id']}/charges/{charge_id}")
    assert del_resp.status_code == 204
    # remaining should go back to 0
    loans_resp = await client.get("/api/loans")
    updated = [l for l in loans_resp.json() if l["id"] == card["id"]][0]
    assert float(updated["remaining_amount"]) == 0.0


async def test_card_summary(client, auth, card):
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 10000, "description": "Buy", "charge_type": "purchase", "charge_date": "2026-01-15",
    })
    await client.post(f"/api/loans/{card['id']}/charges", json={
        "amount": 5000, "description": "Xfer", "charge_type": "transfer", "charge_date": "2026-03-01",
    })
    resp = await client.get(f"/api/loans/{card['id']}/card-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["total_debt"]) == 15000.0
    assert float(data["non_grace_debt"]) == 5000.0
    assert len(data["grace_buckets"]) >= 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_card_charges_api.py -v`
Expected: FAIL — endpoints don't exist yet

- [ ] **Step 3: Implement card charge endpoints**

Add these imports at top of `app/api/routers/loans.py`:
```python
from app.db.models import Loan, LoanPayment, CardCharge
from app.api.schemas.card_charge import (
    CardChargeCreate, CardChargeOut, CardSummary, GraceBucket,
    CardPayoffMonth, CardPayoffResponse,
)
from app.services.card import compute_grace_deadline, compute_min_payment, compute_monthly_interest
from datetime import date as date_type
```

Add these endpoints to `app/api/routers/loans.py` **before** the `/{loan_id}` routes (after `/payoff`):

```python
@router.post("/{loan_id}/charges", response_model=CardChargeOut, status_code=201)
async def add_card_charge(
    loan_id: int,
    body: CardChargeCreate,
    db: AsyncSession = Depends(get_db),
    _u: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.is_active == True))
    loan = result.scalar_one_or_none()
    if not loan or loan.loan_type != "card":
        raise HTTPException(404, "Card not found")

    grace_deadline = compute_grace_deadline(
        body.charge_date, body.charge_type, loan.grace_period_months or 3
    )

    charge = CardCharge(
        loan_id=loan_id,
        amount=body.amount,
        description=body.description,
        charge_type=body.charge_type,
        charge_date=body.charge_date,
        grace_deadline=grace_deadline,
    )
    db.add(charge)
    loan.remaining_amount += body.amount
    await db.commit()
    await db.refresh(charge)

    return _charge_to_out(charge)


@router.get("/{loan_id}/charges", response_model=list[CardChargeOut])
async def list_card_charges(
    loan_id: int,
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    _u: dict = Depends(get_tg_user),
):
    query = select(CardCharge).where(CardCharge.loan_id == loan_id)
    if month:
        year, m = int(month[:4]), int(month[5:7])
        from calendar import monthrange
        start = date_type(year, m, 1)
        end = date_type(year, m, monthrange(year, m)[1])
        query = query.where(CardCharge.charge_date >= start, CardCharge.charge_date <= end)
    query = query.order_by(CardCharge.charge_date.desc())
    result = await db.execute(query)
    return [_charge_to_out(c) for c in result.scalars().all()]


@router.delete("/{loan_id}/charges/{charge_id}", status_code=204)
async def delete_card_charge(
    loan_id: int,
    charge_id: int,
    db: AsyncSession = Depends(get_db),
    _u: dict = Depends(get_tg_user),
):
    result = await db.execute(
        select(CardCharge).where(CardCharge.id == charge_id, CardCharge.loan_id == loan_id)
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(404, "Charge not found")

    loan_result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = loan_result.scalar_one()
    loan.remaining_amount = max(Decimal("0"), loan.remaining_amount - charge.amount)

    await db.delete(charge)
    await db.commit()


@router.get("/{loan_id}/card-summary", response_model=CardSummary)
async def get_card_summary(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    _u: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.is_active == True))
    loan = result.scalar_one_or_none()
    if not loan or loan.loan_type != "card":
        raise HTTPException(404, "Card not found")

    charges_result = await db.execute(
        select(CardCharge).where(CardCharge.loan_id == loan_id, CardCharge.is_paid == False)
    )
    charges = charges_result.scalars().all()

    today = date_type.today()

    # Group purchase charges by grace deadline
    grace_map: dict[date_type, Decimal] = {}
    non_grace_total = Decimal("0")

    for c in charges:
        if c.grace_deadline is not None:
            grace_map.setdefault(c.grace_deadline, Decimal("0"))
            grace_map[c.grace_deadline] += c.amount
        else:
            non_grace_total += c.amount

    grace_buckets = [
        GraceBucket(deadline=dl, total=amt, is_overdue=dl < today)
        for dl, amt in sorted(grace_map.items())
    ]

    # Interest on non-grace debt (transfers/cash and overdue purchases)
    overdue_total = sum(b.total for b in grace_buckets if b.is_overdue)
    interest_bearing = non_grace_total + overdue_total
    accrued_interest = compute_monthly_interest(interest_bearing, loan.interest_rate)

    min_pmt = compute_min_payment(
        debt=loan.remaining_amount,
        accrued_interest=accrued_interest,
        pct=loan.min_payment_pct or Decimal("0.03"),
        floor=loan.min_payment_floor or Decimal("150"),
    )

    available = (loan.credit_limit or Decimal("0")) - loan.remaining_amount

    return CardSummary(
        total_debt=loan.remaining_amount,
        grace_buckets=grace_buckets,
        non_grace_debt=non_grace_total,
        accrued_interest=accrued_interest,
        min_payment=min_pmt,
        available=available,
    )


@router.get("/{loan_id}/card-payoff", response_model=CardPayoffResponse)
async def get_card_payoff(
    loan_id: int,
    monthly_payment: float = 0,
    db: AsyncSession = Depends(get_db),
    _u: dict = Depends(get_tg_user),
):
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.is_active == True))
    loan = result.scalar_one_or_none()
    if not loan or loan.loan_type != "card":
        raise HTTPException(404, "Card not found")

    debt = float(loan.remaining_amount)
    rate = float(loan.interest_rate)
    if debt <= 0:
        return CardPayoffResponse(
            months=[], total_months=0, total_interest=0, total_paid=0,
            recommendations={"zero_interest": 0, "close_in_6": 0, "close_in_12": 0},
        )

    def simulate(pmt: float) -> tuple[list[CardPayoffMonth], float, float]:
        balance = debt
        months_list = []
        total_int = 0.0
        total_pd = 0.0
        today = date_type.today()
        m = 0
        while balance > 0.01 and m < 600:
            m += 1
            month_date = date_type(today.year + (today.month + m - 1) // 12, (today.month + m - 1) % 12 + 1, 1)
            month_str = month_date.strftime("%Y-%m")
            interest = balance * rate / 100 / 12
            actual_payment = min(pmt, balance + interest)
            balance = balance + interest - actual_payment
            total_int += interest
            total_pd += actual_payment
            months_list.append(CardPayoffMonth(
                month=month_str,
                debt_start=round(balance + actual_payment - interest, 2),
                payment=round(actual_payment, 2),
                interest=round(interest, 2),
                debt_end=round(max(balance, 0), 2),
            ))
            if balance <= 0.01:
                break
        return months_list, round(total_int, 2), round(total_pd, 2)

    # Find payment needed to close in N months
    def payment_for_months(n: int) -> float:
        if rate <= 0:
            return round(debt / n, 2) if n > 0 else debt
        r = rate / 100 / 12
        return round(debt * r * (1 + r) ** n / ((1 + r) ** n - 1), 2)

    if monthly_payment <= 0:
        monthly_payment = float(compute_min_payment(
            Decimal(str(debt)), Decimal("0"),
            loan.min_payment_pct or Decimal("0.03"),
            loan.min_payment_floor or Decimal("150"),
        ))

    months, total_interest, total_paid = simulate(monthly_payment)

    recommendations = {
        "zero_interest": round(debt / 3, 2),  # pay off in 3 months = no interest on grace purchases
        "close_in_6": payment_for_months(6),
        "close_in_12": payment_for_months(12),
    }

    return CardPayoffResponse(
        months=months,
        total_months=len(months),
        total_interest=total_interest,
        total_paid=total_paid,
        recommendations=recommendations,
    )


def _charge_to_out(charge: CardCharge) -> CardChargeOut:
    today = date_type.today()
    if charge.is_paid:
        status = "paid"
    elif charge.grace_deadline is None:
        status = "no_grace"
    elif charge.grace_deadline < today:
        status = "overdue"
    else:
        status = "in_grace"

    return CardChargeOut(
        id=charge.id,
        loan_id=charge.loan_id,
        amount=charge.amount,
        description=charge.description,
        charge_type=charge.charge_type,
        charge_date=charge.charge_date,
        grace_deadline=charge.grace_deadline,
        is_paid=charge.is_paid,
        status=status,
    )
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_card_charges_api.py tests/test_card_service.py -v`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/routers/loans.py tests/test_card_charges_api.py
git commit -m "feat: add card charge CRUD, card summary, and card payoff endpoints"
```

---

### Task 5: Frontend — API Client & Types

**Files:**
- Create: `frontend/src/api/card.ts`
- Modify: `frontend/src/api/loans.ts`

- [ ] **Step 1: Create card API client**

```typescript
// frontend/src/api/card.ts
import { api } from './client'

export interface CardCharge {
  id: number
  loan_id: number
  amount: number
  description: string
  charge_type: 'purchase' | 'transfer' | 'cash'
  charge_date: string
  grace_deadline: string | null
  is_paid: boolean
  status: 'in_grace' | 'overdue' | 'paid' | 'no_grace'
}

export interface GraceBucket {
  deadline: string
  total: number
  is_overdue: boolean
}

export interface CardSummary {
  total_debt: number
  grace_buckets: GraceBucket[]
  non_grace_debt: number
  accrued_interest: number
  min_payment: number
  available: number
}

export interface CardPayoffMonth {
  month: string
  debt_start: number
  payment: number
  interest: number
  debt_end: number
}

export interface CardPayoffResponse {
  months: CardPayoffMonth[]
  total_months: number
  total_interest: number
  total_paid: number
  recommendations: { zero_interest: number; close_in_6: number; close_in_12: number }
}

export const fetchCharges = (loanId: number, month?: string) =>
  api.get<CardCharge[]>(`/loans/${loanId}/charges${month ? `?month=${month}` : ''}`).then(r => r.data)

export const addCharge = (loanId: number, data: { amount: number; description: string; charge_type: string; charge_date: string }) =>
  api.post<CardCharge>(`/loans/${loanId}/charges`, data).then(r => r.data)

export const deleteCharge = (loanId: number, chargeId: number) =>
  api.delete(`/loans/${loanId}/charges/${chargeId}`).then(r => r.data)

export const fetchCardSummary = (loanId: number) =>
  api.get<CardSummary>(`/loans/${loanId}/card-summary`).then(r => r.data)

export const fetchCardPayoff = (loanId: number, monthlyPayment: number) =>
  api.get<CardPayoffResponse>(`/loans/${loanId}/card-payoff?monthly_payment=${monthlyPayment}`).then(r => r.data)
```

- [ ] **Step 2: Update Loan interface in loans.ts**

In `frontend/src/api/loans.ts`, replace in the `Loan` interface:
```typescript
  grace_days: number | null
  min_payment: number | null
```

With:
```typescript
  grace_period_months: number | null
  min_payment_pct: number | null
  min_payment_floor: number | null
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/card.ts frontend/src/api/loans.ts
git commit -m "feat: add card API client and update Loan interface"
```

---

### Task 6: Frontend — Updated Card UI in Loans Page

**Files:**
- Modify: `frontend/src/pages/Loans.tsx`

- [ ] **Step 1: Update LoanModal for new card fields**

In `frontend/src/pages/Loans.tsx`, in the `LoanModal` component:

Replace the card-specific state variables:
```typescript
  const [graceDays, setGraceDays] = useState(editLoan?.grace_days?.toString() ?? '')
  const [minPayment, setMinPayment] = useState(editLoan?.min_payment?.toString() ?? '')
```

With:
```typescript
  const [gracePeriodMonths, setGracePeriodMonths] = useState(editLoan?.grace_period_months?.toString() ?? '3')
  const [minPaymentPct, setMinPaymentPct] = useState(editLoan?.min_payment_pct?.toString() ?? '0.03')
  const [minPaymentFloor, setMinPaymentFloor] = useState(editLoan?.min_payment_floor?.toString() ?? '150')
```

In `handleSave` for the card branch, replace:
```typescript
        monthly_payment: parseFloat(minPayment) || 0,
        min_payment: parseFloat(minPayment) || null,
        grace_days: graceDaysVal,
```

With:
```typescript
        monthly_payment: 0,
        grace_period_months: parseInt(gracePeriodMonths) || 3,
        min_payment_pct: parseFloat(minPaymentPct) || 0.03,
        min_payment_floor: parseFloat(minPaymentFloor) || 150,
```

Replace card input fields:
```html
<input style={inputStyle} type="number" placeholder="Льготный период (дней, 0 = просрочен)" value={graceDays} onChange={e => setGraceDays(e.target.value)} />
<input style={inputStyle} type="number" placeholder="Минимальный платёж" value={minPayment} onChange={e => setMinPayment(e.target.value)} />
```

With:
```html
<input style={inputStyle} type="number" placeholder="Льготный период (месяцев, обычно 3)" value={gracePeriodMonths} onChange={e => setGracePeriodMonths(e.target.value)} />
<input style={inputStyle} type="number" placeholder="% мин. платежа (обычно 0.03)" value={minPaymentPct} onChange={e => setMinPaymentPct(e.target.value)} />
<input style={inputStyle} type="number" placeholder="Мин. платёж не менее (обычно 150 ₽)" value={minPaymentFloor} onChange={e => setMinPaymentFloor(e.target.value)} />
```

- [ ] **Step 2: Update LoanCard for cards — add grace buckets and charge button**

Replace the entire card branch of `LoanCard` (the `if (loan.loan_type === 'card')` block) with a version that shows grace buckets and a "Add Charge" button. Add imports at top:

```typescript
import { useState, useEffect, useRef } from 'react'
import { fetchLoans, Loan, recordPayment, createLoan, updateLoan, deleteLoan } from '../api/loans'
import { fetchCardSummary, CardSummary } from '../api/card'
import ExtraPaymentSlider from '../components/ExtraPaymentSlider'
```

Update `LoanCard` props and card branch:

```typescript
function LoanCard({ loan, onPayment, onEdit, onDelete, onAddCharge, onOpenDetail }: {
  loan: Loan; onPayment: () => void; onEdit: () => void; onDelete: () => void;
  onAddCharge?: () => void; onOpenDetail?: () => void
}) {
  const [summary, setSummary] = useState<CardSummary | null>(null)

  useEffect(() => {
    if (loan.loan_type === 'card') {
      fetchCardSummary(loan.id).then(setSummary).catch(() => {})
    }
  }, [loan.id, loan.loan_type, loan.remaining_amount])

  const menuHeader = (icon: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontWeight: 'bold', cursor: onOpenDetail ? 'pointer' : 'default' }}
        onClick={onOpenDetail}>
        {icon} {loan.name}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{loan.bank || ''}</span>
        <CardMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )

  if (loan.loan_type === 'card') {
    const limit = loan.credit_limit ?? 0
    const debt = loan.remaining_amount ?? 0
    const available = summary ? summary.available : limit - debt
    const usedPct = limit > 0 ? debt / limit : 0

    return (
      <div style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: 12 }}>
        {menuHeader('🃏')}
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Долг: <b>₽{debt.toLocaleString('ru')}</b> · Доступно: ₽{available.toLocaleString('ru')} / ₽{limit.toLocaleString('ru')}
        </div>
        <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 6, marginBottom: 8 }}>
          <div style={{ background: usedPct > 0.9 ? '#F44336' : '#FF9800', width: `${Math.min(usedPct * 100, 100)}%`, height: 6, borderRadius: 4 }} />
        </div>

        {summary && summary.grace_buckets.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>ГРЕЙС-ПЕРИОДЫ</div>
            {summary.grace_buckets.map(b => (
              <div key={b.deadline} style={{
                fontSize: 13, marginBottom: 2,
                color: b.is_overdue ? '#F44336' : 'inherit',
              }}>
                {b.is_overdue ? '⚠' : '·'} До {b.deadline}: <b>₽{parseFloat(String(b.total)).toLocaleString('ru')}</b>
              </div>
            ))}
          </div>
        )}

        {summary && summary.non_grace_debt > 0 && (
          <div style={{ fontSize: 13, color: '#F44336', marginBottom: 8 }}>
            Долг с процентами: ₽{parseFloat(String(summary.non_grace_debt)).toLocaleString('ru')} ({loan.interest_rate}% годовых)
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
          <span>Мин. платёж: ₽{summary ? parseFloat(String(summary.min_payment)).toLocaleString('ru') : '...'}</span>
          <span>До: {loan.next_payment_date}</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {onAddCharge && (
            <button onClick={onAddCharge} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E3F2FD', color: '#1976D2', fontSize: 12 }}>
              + Трата
            </button>
          )}
          <button onClick={onPayment} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#E8F5E9', color: '#388E3C', fontSize: 12 }}>
            ✓ Платёж
          </button>
          {onOpenDetail && (
            <button onClick={onOpenDetail} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'rgba(128,128,128,0.1)', color: 'inherit', fontSize: 12, marginLeft: 'auto' }}>
              Подробнее →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ... regular loan rendering stays the same
```

- [ ] **Step 3: Add AddChargeModal component**

Add to `Loans.tsx` before `LoansPage`:

```typescript
function AddChargeModal({ loanId, onClose, onSave }: { loanId: number; onClose: () => void; onSave: () => void }) {
  const [type, setType] = useState<'purchase' | 'transfer' | 'cash'>('purchase')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [chargeDate, setChargeDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { addCharge } = await import('../api/card')
    await addCharge(loanId, {
      amount: parseFloat(amount),
      description: description.trim(),
      charge_type: type,
      charge_date: chargeDate,
    })
    onSave()
    onClose()
  }

  const typeLabels = { purchase: '🛒 Покупка', transfer: '↗ Перевод', cash: '💵 Наличные' } as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: 'var(--tg-theme-bg-color, #1c1c1e)', width: '100%', borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 14, fontSize: 16 }}>Новая трата по карте</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['purchase', 'transfer', 'cash'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 'bold',
              background: type === t ? '#2196F3' : 'rgba(128,128,128,0.15)',
              color: type === t ? '#fff' : 'inherit',
            }}>
              {typeLabels[t]}
            </button>
          ))}
        </div>

        <input style={inputStyle} type="number" placeholder="Сумма *" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        <input style={inputStyle} placeholder="Описание *" value={description} onChange={e => setDescription(e.target.value)} />
        <div style={labelStyle}>Дата *</div>
        <input style={inputStyle} type="date" value={chargeDate} onChange={e => setChargeDate(e.target.value)} />

        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12, padding: '8px 12px', background: 'rgba(128,128,128,0.1)', borderRadius: 8 }}>
          {type === 'purchase'
            ? `ℹ Грейс-период: проценты не начисляются до конца месяца +3`
            : '⚠ Проценты начисляются сразу'}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', fontSize: 14 }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !amount || !description.trim()} style={{ flex: 2, padding: 12, borderRadius: 8, border: 'none', background: '#2196F3', color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
            {saving ? '...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update LoansPage state and handlers**

Add to LoansPage state:
```typescript
const [chargingLoanId, setChargingLoanId] = useState<number | undefined>()
const [detailLoan, setDetailLoan] = useState<Loan | undefined>()
```

Update card rendering in LoansPage to pass new props:
```typescript
{cards.map(loan => (
  <LoanCard key={loan.id} loan={loan}
    onPayment={() => handlePayment(loan)}
    onEdit={() => handleEdit(loan)}
    onDelete={() => setDeletingLoan(loan)}
    onAddCharge={() => setChargingLoanId(loan.id)}
    onOpenDetail={() => setDetailLoan(loan)}
  />
))}
```

Add modals at bottom of LoansPage return:
```typescript
{chargingLoanId && (
  <AddChargeModal
    loanId={chargingLoanId}
    onClose={() => setChargingLoanId(undefined)}
    onSave={load}
  />
)}
```

- [ ] **Step 5: Build frontend**

Run: `cd frontend && npx tsc && npx vite build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Loans.tsx
git commit -m "feat: update card UI with grace buckets, charge modal, and detail link"
```

---

### Task 7: Frontend — Card Detail Page (Charges + Calculator)

**Files:**
- Create: `frontend/src/pages/CardDetail.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Loans.tsx`

- [ ] **Step 1: Create CardDetail page**

```typescript
// frontend/src/pages/CardDetail.tsx
import { useEffect, useState } from 'react'
import { Loan } from '../api/loans'
import {
  fetchCharges, fetchCardPayoff, fetchCardSummary,
  CardCharge, CardPayoffResponse, CardSummary, deleteCharge,
} from '../api/card'

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 0', border: 'none', fontSize: 14, fontWeight: 'bold',
  background: active ? '#2196F3' : 'transparent',
  color: active ? '#fff' : 'inherit',
  borderRadius: 8, cursor: 'pointer',
})

export default function CardDetail({ loan, onBack }: { loan: Loan; onBack: () => void }) {
  const [tab, setTab] = useState<'charges' | 'calc'>('charges')
  const [charges, setCharges] = useState<CardCharge[]>([])
  const [summary, setSummary] = useState<CardSummary | null>(null)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Calculator state
  const [payment, setPayment] = useState(30000)
  const [payoff, setPayoff] = useState<CardPayoffResponse | null>(null)

  const loadCharges = () => fetchCharges(loan.id, month).then(setCharges)
  const loadSummary = () => fetchCardSummary(loan.id).then(setSummary)

  useEffect(() => { loadCharges() }, [month])
  useEffect(() => { loadSummary() }, [])
  useEffect(() => {
    if (tab === 'calc') fetchCardPayoff(loan.id, payment).then(setPayoff)
  }, [tab, payment])

  const handleDeleteCharge = async (chargeId: number) => {
    await deleteCharge(loan.id, chargeId)
    loadCharges()
    loadSummary()
  }

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const [yr, mn] = month.split('-').map(Number)
  const monthLabel = `${monthNames[mn]} ${yr}`

  const statusColor = (s: string) => {
    if (s === 'in_grace') return '#4CAF50'
    if (s === 'overdue') return '#F44336'
    if (s === 'paid') return '#9E9E9E'
    return '#FF9800'
  }

  const statusLabel = (s: string) => {
    if (s === 'in_grace') return 'В грейсе'
    if (s === 'overdue') return 'Просрочен'
    if (s === 'paid') return 'Оплачен'
    return 'Без грейса'
  }

  const typeLabel = (t: string) => {
    if (t === 'purchase') return '🛒'
    if (t === 'transfer') return '↗'
    return '💵'
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 18, color: 'inherit', cursor: 'pointer' }}>←</button>
        <h3 style={{ margin: 0 }}>🃏 {loan.name}</h3>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ background: 'rgba(128,128,128,0.1)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            Долг: <b>₽{parseFloat(String(summary.total_debt)).toLocaleString('ru')}</b>
          </div>
          {summary.accrued_interest > 0 && (
            <div style={{ fontSize: 13, color: '#F44336' }}>
              Начисленные проценты: ₽{parseFloat(String(summary.accrued_interest)).toLocaleString('ru')}
            </div>
          )}
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            Мин. платёж: ₽{parseFloat(String(summary.min_payment)).toLocaleString('ru')}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={tabStyle(tab === 'charges')} onClick={() => setTab('charges')}>Траты</button>
        <button style={tabStyle(tab === 'calc')} onClick={() => setTab('calc')}>Калькулятор</button>
      </div>

      {tab === 'charges' && (
        <>
          {/* Month nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => shiftMonth(-1)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'inherit' }}>←</button>
            <span style={{ fontWeight: 'bold' }}>{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'inherit' }}>→</button>
          </div>

          {charges.length === 0 ? (
            <div style={{ opacity: 0.5, textAlign: 'center', marginTop: 20 }}>Нет трат за этот месяц</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {charges.map(c => (
                <div key={c.id} style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14 }}>{typeLabel(c.charge_type)} {c.description}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {c.charge_date}
                      {c.grace_deadline && ` · грейс до ${c.grace_deadline}`}
                    </div>
                    <span style={{ fontSize: 11, color: statusColor(c.status) }}>{statusLabel(c.status)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold' }}>₽{parseFloat(String(c.amount)).toLocaleString('ru')}</span>
                    <button onClick={() => handleDeleteCharge(c.id)} style={{ background: 'none', border: 'none', color: '#F44336', fontSize: 14, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'calc' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Готов платить в месяц:</div>
            <input
              type="range"
              min={1000} max={Math.max(200000, loan.remaining_amount)} step={1000}
              value={payment}
              onChange={e => setPayment(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>₽{payment.toLocaleString('ru')}</div>
          </div>

          {/* Recommendations */}
          {payoff && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Без %', value: payoff.recommendations.zero_interest },
                  { label: 'За 6 мес', value: payoff.recommendations.close_in_6 },
                  { label: 'За 12 мес', value: payoff.recommendations.close_in_12 },
                ].map(r => (
                  <button key={r.label} onClick={() => setPayment(Math.ceil(r.value))}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', color: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                    <div style={{ fontWeight: 'bold' }}>{r.label}</div>
                    <div>₽{Math.ceil(r.value).toLocaleString('ru')}/мес</div>
                  </button>
                ))}
              </div>

              <div style={{ background: 'rgba(128,128,128,0.1)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div>Закроете за <b>{payoff.total_months} мес.</b></div>
                <div>Переплата: <b style={{ color: '#F44336' }}>₽{payoff.total_interest.toLocaleString('ru')}</b></div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>Всего заплатите: ₽{payoff.total_paid.toLocaleString('ru')}</div>
              </div>

              {/* Monthly table */}
              <div style={{ fontSize: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ opacity: 0.6 }}>
                      <th style={{ textAlign: 'left', padding: 4 }}>Месяц</th>
                      <th style={{ textAlign: 'right', padding: 4 }}>Долг</th>
                      <th style={{ textAlign: 'right', padding: 4 }}>Платёж</th>
                      <th style={{ textAlign: 'right', padding: 4 }}>%</th>
                      <th style={{ textAlign: 'right', padding: 4 }}>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoff.months.map(m => (
                      <tr key={m.month}>
                        <td style={{ padding: 4 }}>{m.month}</td>
                        <td style={{ textAlign: 'right', padding: 4 }}>₽{m.debt_start.toLocaleString('ru')}</td>
                        <td style={{ textAlign: 'right', padding: 4 }}>₽{m.payment.toLocaleString('ru')}</td>
                        <td style={{ textAlign: 'right', padding: 4, color: '#F44336' }}>₽{m.interest.toLocaleString('ru')}</td>
                        <td style={{ textAlign: 'right', padding: 4 }}>₽{m.debt_end.toLocaleString('ru')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrate CardDetail into Loans page**

In `frontend/src/pages/Loans.tsx`, add import and conditional rendering:

Add at top:
```typescript
import CardDetail from './CardDetail'
```

In `LoansPage`, if `detailLoan` is set, render the detail page instead:

```typescript
export default function LoansPage() {
  // ... existing state ...
  const [detailLoan, setDetailLoan] = useState<Loan | undefined>()

  // ... existing handlers ...

  if (detailLoan) {
    return <CardDetail loan={detailLoan} onBack={() => { setDetailLoan(undefined); load() }} />
  }

  return (
    // ... existing JSX ...
  )
}
```

- [ ] **Step 3: Build frontend**

Run: `cd frontend && npx tsc && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CardDetail.tsx frontend/src/pages/Loans.tsx
git commit -m "feat: add card detail page with charges list and payoff calculator"
```

---

### Task 8: Deploy & Migrate

- [ ] **Step 1: Build frontend dist**

Run: `cd frontend && npx tsc && npx vite build`

- [ ] **Step 2: Commit dist and push**

```bash
git add -f frontend/dist/
git commit -m "chore: rebuild frontend dist"
git push
```

- [ ] **Step 3: Deploy on server**

```bash
ssh root@79.110.227.22
cd /root/moneytalks && git pull && docker-compose up -d --build app
docker-compose exec app python -m alembic -c alembic.ini upgrade head
docker-compose restart nginx
```

- [ ] **Step 4: Verify**

- Open Mini App in Telegram
- Navigate to Кредиты
- Verify card shows grace buckets
- Add a charge (purchase) — verify grace deadline appears
- Add a charge (transfer) — verify "no_grace" status
- Open card detail — verify charges list
- Open calculator — verify payoff table and recommendations
