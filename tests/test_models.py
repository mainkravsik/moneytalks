import pytest
from app.db.models import (
    User, BudgetPeriod, Category, BudgetLimit,
    Transaction, PiggyBank, PiggyContribution, Loan, LoanPayment
)


def test_all_models_importable():
    """Smoke test — all ORM models can be imported."""
    assert User.__tablename__ == "users"
    assert BudgetPeriod.__tablename__ == "budget_periods"
    assert Category.__tablename__ == "categories"
    assert BudgetLimit.__tablename__ == "budget_limits"
    assert Transaction.__tablename__ == "transactions"
    assert PiggyBank.__tablename__ == "piggy_banks"
    assert PiggyContribution.__tablename__ == "piggy_contributions"
    assert Loan.__tablename__ == "loans"
    assert LoanPayment.__tablename__ == "loan_payments"
