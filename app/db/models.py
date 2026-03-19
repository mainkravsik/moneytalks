from datetime import datetime, date
from sqlalchemy import (
    Integer, String, Boolean, Numeric, Date, DateTime,
    ForeignKey, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BudgetPeriod(Base):
    __tablename__ = "budget_periods"
    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int]
    month: Mapped[int]
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    emoji: Mapped[str] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BudgetLimit(Base):
    __tablename__ = "budget_limits"
    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("budget_periods.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    limit_amount: Mapped[float] = mapped_column(Numeric(12, 2))


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PiggyBank(Base):
    __tablename__ = "piggy_banks"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    current_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PiggyContribution(Base):
    __tablename__ = "piggy_contributions"
    id: Mapped[int] = mapped_column(primary_key=True)
    piggy_bank_id: Mapped[int] = mapped_column(ForeignKey("piggy_banks.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Loan(Base):
    __tablename__ = "loans"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    bank: Mapped[str | None] = mapped_column(String(100), nullable=True)
    original_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    remaining_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 2))  # % годовых
    monthly_payment: Mapped[float] = mapped_column(Numeric(12, 2))
    next_payment_date: Mapped[date] = mapped_column(Date)
    payment_type: Mapped[str] = mapped_column(String(20), default="annuity")  # annuity | differentiated
    start_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoanPayment(Base):
    __tablename__ = "loan_payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
