from datetime import datetime, timezone, date as date_type
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.deps import get_or_create_user
from app.api.schemas.loan import LoanCreate, LoanUpdate, LoanOut, LoanPaymentBody, PayoffResponse, StrategyResult
from app.api.schemas.card_charge import (
    CardChargeCreate, CardChargeOut, CardSummary, GraceBucket,
    CardPayoffMonth, CardPayoffResponse,
)
from app.db.base import get_db
from app.db.models import Loan, LoanPayment, CardCharge
from app.services.payoff import LoanInput, calculate_payoff
from app.services.card import compute_grace_deadline, compute_min_payment, compute_monthly_interest

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
        raise HTTPException(404, "Loan not found")
    for field_name, val in body.model_dump(exclude_none=True).items():
        setattr(loan, field_name, val)
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
        raise HTTPException(404, "Loan not found")

    user = await get_or_create_user(tg_user, db)

    paid_at = body.paid_at or datetime.now(timezone.utc)
    db.add(LoanPayment(loan_id=loan_id, user_id=user.id, amount=body.amount, paid_at=paid_at))

    loan.remaining_amount = max(Decimal("0"), loan.remaining_amount - body.amount)
    loan.next_payment_date = loan.next_payment_date + relativedelta(months=1)

    if loan.remaining_amount <= 0:
        loan.is_active = False

    await db.commit()
    await db.refresh(loan)
    return loan


@router.delete("/{loan_id}", status_code=204)
async def delete_loan(loan_id: int, db: AsyncSession = Depends(get_db), _u: dict = Depends(get_tg_user)):
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.is_active == True))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(404, "Loan not found")
    loan.is_active = False
    await db.commit()


# --- Card Charge Endpoints ---

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
    import calendar as cal
    query = select(CardCharge).where(CardCharge.loan_id == loan_id)
    if month:
        year, m = int(month[:4]), int(month[5:7])
        start = date_type(year, m, 1)
        end = date_type(year, m, cal.monthrange(year, m)[1])
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
            raw_month = today.month + m - 1
            sim_year = today.year + raw_month // 12
            sim_month = raw_month % 12 + 1
            month_str = f"{sim_year}-{sim_month:02d}"
            interest = balance * rate / 100 / 12
            actual_payment = min(pmt, balance + interest)
            debt_start = round(balance, 2)
            balance = balance + interest - actual_payment
            total_int += interest
            total_pd += actual_payment
            months_list.append(CardPayoffMonth(
                month=month_str,
                debt_start=debt_start,
                payment=round(actual_payment, 2),
                interest=round(interest, 2),
                debt_end=round(max(balance, 0), 2),
            ))
            if balance <= 0.01:
                break
        return months_list, round(total_int, 2), round(total_pd, 2)

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
        "zero_interest": round(debt / 3, 2),
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
