from decimal import Decimal


def calculate_safe_to_spend(
    total_limits: Decimal,
    total_spent: Decimal,
    unpaid_loan_payments: Decimal,
) -> Decimal:
    return total_limits - total_spent - unpaid_loan_payments
