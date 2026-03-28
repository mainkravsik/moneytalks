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
    result = compute_grace_deadline(date(2026, 1, 15), "purchase", grace_months=3)
    assert result == date(2026, 4, 30)


def test_grace_deadline_purchase_october():
    result = compute_grace_deadline(date(2026, 10, 5), "purchase", grace_months=3)
    assert result == date(2027, 1, 31)


def test_grace_deadline_purchase_november():
    result = compute_grace_deadline(date(2026, 11, 20), "purchase", grace_months=3)
    assert result == date(2027, 2, 28)


def test_grace_deadline_transfer_returns_none():
    result = compute_grace_deadline(date(2026, 1, 15), "transfer", grace_months=3)
    assert result is None


def test_grace_deadline_cash_returns_none():
    result = compute_grace_deadline(date(2026, 3, 1), "cash", grace_months=3)
    assert result is None


def test_min_payment_normal():
    result = compute_min_payment(
        debt=Decimal("338712.06"), accrued_interest=Decimal("0"),
        pct=Decimal("0.03"), floor=Decimal("150"),
    )
    assert result == Decimal("10161.36")


def test_min_payment_floor():
    result = compute_min_payment(
        debt=Decimal("4000"), accrued_interest=Decimal("0"),
        pct=Decimal("0.03"), floor=Decimal("150"),
    )
    assert result == Decimal("150")


def test_min_payment_with_interest():
    result = compute_min_payment(
        debt=Decimal("100000"), accrued_interest=Decimal("500"),
        pct=Decimal("0.03"), floor=Decimal("150"),
    )
    assert result == Decimal("3500")


def test_min_payment_zero_debt():
    result = compute_min_payment(
        debt=Decimal("0"), accrued_interest=Decimal("0"),
        pct=Decimal("0.03"), floor=Decimal("150"),
    )
    assert result == Decimal("0")


def test_monthly_interest():
    result = compute_monthly_interest(
        amount=Decimal("338712.06"), annual_rate=Decimal("25.4"),
    )
    assert result == Decimal("7169.41")


def test_monthly_interest_zero_rate():
    result = compute_monthly_interest(
        amount=Decimal("100000"), annual_rate=Decimal("0"),
    )
    assert result == Decimal("0")
