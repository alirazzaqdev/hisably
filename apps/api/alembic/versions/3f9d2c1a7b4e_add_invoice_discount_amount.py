"""add discount_amount to invoices

Revision ID: 3f9d2c1a7b4e
Revises: 29b40581ac0a
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3f9d2c1a7b4e"
down_revision = "29b40581ac0a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("discount_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
    )
    op.alter_column("invoices", "discount_amount", server_default=None)


def downgrade() -> None:
    op.drop_column("invoices", "discount_amount")
