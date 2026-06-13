"""add mm dimensions and override total to invoice line items

Revision ID: 97176ba7d53f
Revises: 9c2e4f6a8b1d
Create Date: 2026-06-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "97176ba7d53f"
down_revision = "9c2e4f6a8b1d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("invoice_line_items", "width", new_column_name="width_mm")
    op.alter_column("invoice_line_items", "height", new_column_name="height_mm")
    op.add_column(
        "invoice_line_items",
        sa.Column("length_mm", sa.Numeric(12, 3), nullable=True),
    )
    op.add_column(
        "invoice_line_items",
        sa.Column("computed_total", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "invoice_line_items",
        sa.Column("override_total", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoice_line_items", "override_total")
    op.drop_column("invoice_line_items", "computed_total")
    op.drop_column("invoice_line_items", "length_mm")
    op.alter_column("invoice_line_items", "height_mm", new_column_name="height")
    op.alter_column("invoice_line_items", "width_mm", new_column_name="width")
