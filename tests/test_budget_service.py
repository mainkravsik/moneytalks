from decimal import Decimal
import pytest
from app.services.budget import calculate_safe_to_spend


def test_safe_to_spend_basic():
    """sum(limits) - sum(transactions) - unpaid loans."""
    result = calculate_safe_to_spend(
        total_limits=Decimal("50000"),
        total_spent=Decimal("20000"),
        unpaid_loan_payments=Decimal("5000"),
    )
    assert result == Decimal("25000")


def test_safe_to_spend_can_be_negative():
    """Overspending is represented as negative number."""
    result = calculate_safe_to_spend(
        total_limits=Decimal("10000"),
        total_spent=Decimal("12000"),
        unpaid_loan_payments=Decimal("0"),
    )
    assert result == Decimal("-2000")
