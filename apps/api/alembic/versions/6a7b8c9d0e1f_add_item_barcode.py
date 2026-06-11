"""add items.barcode

Revision ID: 6a7b8c9d0e1f
Revises: 5f6a7b8c9d0e
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6a7b8c9d0e1f"
down_revision = "5f6a7b8c9d0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("items", sa.Column("barcode", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_items_barcode"), "items", ["barcode"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_items_barcode"), table_name="items")
    op.drop_column("items", "barcode")
