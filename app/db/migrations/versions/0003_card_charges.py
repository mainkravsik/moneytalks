"""add card_charges table and update loan card fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'card_charges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('loan_id', sa.Integer(), sa.ForeignKey('loans.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.String(200), nullable=False),
        sa.Column('charge_type', sa.String(20), nullable=False),
        sa.Column('charge_date', sa.Date(), nullable=False),
        sa.Column('grace_deadline', sa.Date(), nullable=True),
        sa.Column('is_paid', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column('loans', sa.Column('grace_period_months', sa.Integer(), nullable=True))
    op.add_column('loans', sa.Column('min_payment_pct', sa.Numeric(5, 4), nullable=True))
    op.add_column('loans', sa.Column('min_payment_floor', sa.Numeric(12, 2), nullable=True))
    op.execute("""
        UPDATE loans
        SET grace_period_months = 3,
            min_payment_pct = 0.03,
            min_payment_floor = COALESCE(min_payment, 150)
        WHERE loan_type = 'card'
    """)
    op.drop_column('loans', 'grace_days')
    op.drop_column('loans', 'min_payment')


def downgrade() -> None:
    op.add_column('loans', sa.Column('grace_days', sa.Integer(), nullable=True))
    op.add_column('loans', sa.Column('min_payment', sa.Numeric(12, 2), nullable=True))
    op.execute("""
        UPDATE loans
        SET grace_days = COALESCE(grace_period_months, 0) * 30,
            min_payment = min_payment_floor
        WHERE loan_type = 'card'
    """)
    op.drop_column('loans', 'grace_period_months')
    op.drop_column('loans', 'min_payment_pct')
    op.drop_column('loans', 'min_payment_floor')
    op.drop_table('card_charges')
