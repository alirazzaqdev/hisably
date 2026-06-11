"""add accounts table and payments.account_id

Revision ID: 7a1c5e9d2f3b
Revises: 3f9d2c1a7b4e
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7a1c5e9d2f3b"
down_revision = "3f9d2c1a7b4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.Enum("CASH", "BANK", name="accounttype", native_enum=False), nullable=False),
        sa.Column("bank_name", sa.String(length=255), nullable=True),
        sa.Column("account_number", sa.String(length=64), nullable=True),
        sa.Column("opening_balance", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_tenant_id"), "accounts", ["tenant_id"], unique=False)
    op.alter_column("accounts", "opening_balance", server_default=None)

    op.add_column("payments", sa.Column("account_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_payments_account_id_accounts", "payments", "accounts", ["account_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_payments_account_id_accounts", "payments", type_="foreignkey")
    op.drop_column("payments", "account_id")

    op.drop_index(op.f("ix_accounts_tenant_id"), table_name="accounts")
    op.drop_table("accounts")
