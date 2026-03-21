"""add loan_type and card fields to loans

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('loans', sa.Column('loan_type', sa.String(20), nullable=False, server_default='loan'))
    op.add_column('loans', sa.Column('credit_limit', sa.Numeric(12, 2), nullable=True))
    op.add_column('loans', sa.Column('grace_days', sa.Integer(), nullable=True))
    op.add_column('loans', sa.Column('min_payment', sa.Numeric(12, 2), nullable=True))
    # Make original_amount and start_date nullable (they're optional for cards)
    op.alter_column('loans', 'original_amount', nullable=True)
    op.alter_column('loans', 'start_date', nullable=True)


def downgrade() -> None:
    op.drop_column('loans', 'loan_type')
    op.drop_column('loans', 'credit_limit')
    op.drop_column('loans', 'grace_days')
    op.drop_column('loans', 'min_payment')
    op.alter_column('loans', 'original_amount', nullable=False)
    op.alter_column('loans', 'start_date', nullable=False)
