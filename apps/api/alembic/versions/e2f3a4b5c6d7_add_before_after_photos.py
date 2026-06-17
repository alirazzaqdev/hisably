"""add before_after_photos to invoices

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("before_photos", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("invoices", sa.Column("after_photos", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("invoices", "after_photos")
    op.drop_column("invoices", "before_photos")
