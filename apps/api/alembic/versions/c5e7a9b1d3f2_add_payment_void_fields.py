"""add voided_at and void_reason to payments

Revision ID: c5e7a9b1d3f2
Revises: b3d5f7a9c1e3
Create Date: 2026-06-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c5e7a9b1d3f2"
down_revision = "b3d5f7a9c1e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("void_reason", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "void_reason")
    op.drop_column("payments", "voided_at")
