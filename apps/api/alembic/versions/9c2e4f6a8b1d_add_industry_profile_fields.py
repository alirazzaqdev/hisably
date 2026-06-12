"""add industry profile fields to tenants

Revision ID: 9c2e4f6a8b1d
Revises: 8b1d3e5f7a2c
Create Date: 2026-06-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9c2e4f6a8b1d"
down_revision = "8b1d3e5f7a2c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("industry_profile", sa.String(length=32), nullable=False, server_default="general"),
    )
    op.add_column(
        "tenants",
        sa.Column("enabled_fields", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "tenants",
        sa.Column("field_labels", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "field_labels")
    op.drop_column("tenants", "enabled_fields")
    op.drop_column("tenants", "industry_profile")
