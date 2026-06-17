"""add vat_rate_override and language_secondary to invoices

Revision ID: c1d2e3f4a5b6
Revises: e6f7a8b9c0d1
Create Date: 2026-06-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c1d2e3f4a5b6"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("vat_rate_override", sa.Numeric(5, 2), nullable=True))
    op.add_column("invoices", sa.Column("language_secondary", sa.String(10), nullable=True))
    # Migrate old "bilingual" rows to primary=en + secondary=ar
    op.execute("UPDATE invoices SET language = 'en', language_secondary = 'ar' WHERE language = 'bilingual'")


def downgrade() -> None:
    op.drop_column("invoices", "language_secondary")
    op.drop_column("invoices", "vat_rate_override")
