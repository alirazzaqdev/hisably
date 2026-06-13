"""add branding fields to tenants

Revision ID: d4f6a8c0e2b7
Revises: c4d6e8f0a2b5
Create Date: 2026-06-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4f6a8c0e2b7"
down_revision = "c4d6e8f0a2b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("stamp_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("signature_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("branding_options", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "branding_options")
    op.drop_column("tenants", "signature_url")
    op.drop_column("tenants", "stamp_url")
