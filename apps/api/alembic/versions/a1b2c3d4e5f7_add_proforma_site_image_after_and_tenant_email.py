"""add proforma after site image and tenant contact email

Revision ID: a1b2c3d4e5f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-16 00:00:00.000001

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("site_image_after_url", sa.String(length=500), nullable=True))
    op.add_column("tenants", sa.Column("contact_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "contact_email")
    op.drop_column("invoices", "site_image_after_url")
