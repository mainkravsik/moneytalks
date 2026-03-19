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
