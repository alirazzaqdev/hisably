"""add site_image_url to invoices

Revision ID: a2c4e6f8b0d2
Revises: f1b2c3d4e5a6
Create Date: 2026-06-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a2c4e6f8b0d2"
down_revision = "f1b2c3d4e5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("site_image_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "site_image_url")
