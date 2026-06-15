"""add expiry_notified_at to invoices

Revision ID: b3d5f7a9c1e3
Revises: a2c4e6f8b0d2
Create Date: 2026-06-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b3d5f7a9c1e3"
down_revision = "a2c4e6f8b0d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("expiry_notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "expiry_notified_at")
