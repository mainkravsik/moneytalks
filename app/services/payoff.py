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
