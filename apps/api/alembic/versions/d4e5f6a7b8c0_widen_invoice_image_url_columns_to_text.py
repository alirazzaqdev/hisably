"""widen invoice site_image_url/site_image_after_url from VARCHAR(500) to TEXT

Revision ID: d4e5f6a7b8c0
Revises: c3d4e5f6a7b9
Create Date: 2026-06-17 00:00:02.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c0"
down_revision = "c3d4e5f6a7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("invoices", "site_image_url", type_=sa.Text(), existing_nullable=True)
    op.alter_column("invoices", "site_image_after_url", type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("invoices", "site_image_url", type_=sa.String(500), existing_nullable=True)
    op.alter_column("invoices", "site_image_after_url", type_=sa.String(500), existing_nullable=True)
