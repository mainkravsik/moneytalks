import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

TWO_PLACES = Decimal("0.01")


def compute_grace_deadline(charge_date: date, charge_type: str, grace_months: int = 3) -> date | None:
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
    debt: Decimal, accrued_interest: Decimal,
    pct: Decimal = Decimal("0.03"), floor: Decimal = Decimal("150"),
) -> Decimal:
    if debt <= 0:
        return Decimal("0")
    base = max((debt * pct).quantize(TWO_PLACES, ROUND_HALF_UP), floor)
    return (base + accrued_interest).quantize(TWO_PLACES, ROUND_HALF_UP)


def compute_monthly_interest(amount: Decimal, annual_rate: Decimal) -> Decimal:
    if annual_rate <= 0 or amount <= 0:
        return Decimal("0")
    return (amount * annual_rate / 100 / 12).quantize(TWO_PLACES, ROUND_HALF_UP)
