"""add loan_rate_periods table and increase interest_rate precision

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-28 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'loan_rate_periods',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('loan_id', sa.Integer(), sa.ForeignKey('loans.id'), nullable=False),
        sa.Column('rate', sa.Numeric(7, 3), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
    )
    # Increase interest_rate precision: Numeric(5,2) -> Numeric(7,3)
    op.alter_column('loans', 'interest_rate',
                     type_=sa.Numeric(7, 3),
                     existing_type=sa.Numeric(5, 2))


def downgrade() -> None:
    op.alter_column('loans', 'interest_rate',
                     type_=sa.Numeric(5, 2),
                     existing_type=sa.Numeric(7, 3))
    op.drop_table('loan_rate_periods')
