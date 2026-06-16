"""widen tenant logo_url/stamp_url/signature_url from VARCHAR(500) to TEXT

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-06-17 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b9"
down_revision = "b2c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("tenants", "logo_url", type_=sa.Text(), existing_nullable=True)
    op.alter_column("tenants", "stamp_url", type_=sa.Text(), existing_nullable=True)
    op.alter_column("tenants", "signature_url", type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("tenants", "logo_url", type_=sa.String(500), existing_nullable=True)
    op.alter_column("tenants", "stamp_url", type_=sa.String(500), existing_nullable=True)
    op.alter_column("tenants", "signature_url", type_=sa.String(500), existing_nullable=True)
