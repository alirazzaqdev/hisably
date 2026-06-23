"""widen line_item description columns to text (no limit)

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("invoice_line_items", "description", type_=sa.Text())
    op.alter_column("invoice_line_items", "description_ar", type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("invoice_line_items", "description", type_=sa.String(500))
    op.alter_column("invoice_line_items", "description_ar", type_=sa.String(500), existing_nullable=True)
