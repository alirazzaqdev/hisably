"""add unit column to invoice_line_items

Revision ID: e6f7a8b9c0d1
Revises: d4e5f6a7b8c0
Create Date: 2026-06-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "d4e5f6a7b8c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoice_line_items",
        sa.Column("unit", sa.String(16), nullable=True, server_default="pcs"),
    )


def downgrade() -> None:
    op.drop_column("invoice_line_items", "unit")
