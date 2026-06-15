"""add quotation_prefix to tenants

Revision ID: f1b2c3d4e5a6
Revises: e5a7b9c1d3f0
Create Date: 2026-06-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f1b2c3d4e5a6"
down_revision = "e5a7b9c1d3f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("quotation_prefix", sa.String(length=16), nullable=False, server_default="QUO-"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "quotation_prefix")
