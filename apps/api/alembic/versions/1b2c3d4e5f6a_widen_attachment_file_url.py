"""widen attachments.file_url to text

Revision ID: 1b2c3d4e5f6a
Revises: 7a1c5e9d2f3b
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1b2c3d4e5f6a"
down_revision = "7a1c5e9d2f3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("attachments", "file_url", type_=sa.Text(), existing_type=sa.String(length=500))


def downgrade() -> None:
    op.alter_column("attachments", "file_url", type_=sa.String(length=500), existing_type=sa.Text())
