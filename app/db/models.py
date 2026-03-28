from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Integer, String, Boolean, Numeric, Date, DateTime,
    ForeignKey, Text, func, UniqueConstraint
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
    __table_args__ = (UniqueConstraint("year", "month", name="uq_budget_periods_year_month"),)
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
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
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
    target_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PiggyContribution(Base):
    __tablename__ = "piggy_contributions"
    id: Mapped[int] = mapped_column(primary_key=True)
    piggy_bank_id: Mapped[int] = mapped_column(ForeignKey("piggy_banks.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Loan(Base):
    __tablename__ = "loans"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_type: Mapped[str] = mapped_column(String(20), default="loan")  # loan | card
    name: Mapped[str] = mapped_column(String(100))
    bank: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Loan fields
    original_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    remaining_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(7, 3))  # % годовых
    monthly_payment: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    next_payment_date: Mapped[date] = mapped_column(Date)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_type: Mapped[str] = mapped_column(String(20), default="annuity")  # annuity | differentiated
    # Card-only fields
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    grace_period_months: Mapped[int | None] = mapped_column(Integer, nullable=True, default=3)
    min_payment_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True, default=Decimal("0.03"))
    min_payment_floor: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True, default=Decimal("150"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    rate_periods: Mapped[list["LoanRatePeriod"]] = relationship("LoanRatePeriod", lazy="selectin", cascade="all, delete-orphan")


class LoanPayment(Base):
    __tablename__ = "loan_payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoanRatePeriod(Base):
    __tablename__ = "loan_rate_periods"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 3))  # % годовых
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # NULL = бессрочно


class CardCharge(Base):
    __tablename__ = "card_charges"
    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str] = mapped_column(String(200))
    charge_type: Mapped[str] = mapped_column(String(20))  # purchase | transfer | cash
    charge_date: Mapped[date] = mapped_column(Date)
    grace_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
