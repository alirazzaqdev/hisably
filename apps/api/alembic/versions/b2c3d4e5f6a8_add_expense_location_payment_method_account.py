"""add location, payment method, and account to expense entries

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-06-16 00:00:02.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expense_entries", sa.Column("location", sa.String(length=255), nullable=True))
    op.add_column(
        "expense_entries",
        sa.Column(
            "payment_method",
            sa.Enum("CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER", name="paymentmethod", native_enum=False),
            nullable=False,
            server_default="CASH",
        ),
    )
    op.add_column("expense_entries", sa.Column("account_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_expense_entries_account_id_accounts", "expense_entries", "accounts", ["account_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_expense_entries_account_id_accounts", "expense_entries", type_="foreignkey")
    op.drop_column("expense_entries", "account_id")
    op.drop_column("expense_entries", "payment_method")
    op.drop_column("expense_entries", "location")
