"""add account_transfers table

Revision ID: d7f9b1c3e5a4
Revises: c5e7a9b1d3f2
Create Date: 2026-06-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d7f9b1c3e5a4"
down_revision = "c5e7a9b1d3f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_transfers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("from_account_id", sa.Uuid(), nullable=False),
        sa.Column("to_account_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("transfer_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("client_uuid", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["from_account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["to_account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_uuid"),
    )
    op.create_index(op.f("ix_account_transfers_tenant_id"), "account_transfers", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_account_transfers_tenant_id"), table_name="account_transfers")
    op.drop_table("account_transfers")
