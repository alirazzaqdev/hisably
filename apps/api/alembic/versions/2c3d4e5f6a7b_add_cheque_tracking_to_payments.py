"""add cheque/PDC tracking fields to payments

Revision ID: 2c3d4e5f6a7b
Revises: 1b2c3d4e5f6a
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2c3d4e5f6a7b"
down_revision = "1b2c3d4e5f6a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("cheque_number", sa.String(length=50), nullable=True))
    op.add_column("payments", sa.Column("cheque_date", sa.Date(), nullable=True))
    op.add_column(
        "payments",
        sa.Column("cheque_status", sa.Enum("PENDING", "CLEARED", "BOUNCED", name="chequestatus", native_enum=False), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payments", "cheque_status")
    op.drop_column("payments", "cheque_date")
    op.drop_column("payments", "cheque_number")
