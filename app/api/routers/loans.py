from datetime import datetime, timezone
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth import get_tg_user
from app.api.deps import get_or_create_user
from app.api.schemas.loan import LoanCreate, LoanUpdate, LoanOut, LoanPaymentBody, PayoffResponse, StrategyResult
from app.db.base import get_db
from app.db.models import Loan, LoanPayment
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
