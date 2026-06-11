"""add recurring invoices table

Revision ID: 3d4e5f6a7b8c
Revises: 2c3d4e5f6a7b
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3d4e5f6a7b8c"
down_revision = "2c3d4e5f6a7b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recurring_invoices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column(
            "frequency",
            sa.Enum("WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", name="recurrencefrequency", native_enum=False),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("next_run_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="AED"),
        sa.Column("discount_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("terms", sa.String(length=2000), nullable=True),
        sa.Column("line_items", sa.JSON(), nullable=False),
        sa.Column("last_generated_invoice_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["last_generated_invoice_id"], ["invoices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recurring_invoices_tenant_id"), "recurring_invoices", ["tenant_id"], unique=False)
    op.alter_column("recurring_invoices", "is_active", server_default=None)
    op.alter_column("recurring_invoices", "currency", server_default=None)
    op.alter_column("recurring_invoices", "discount_amount", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_recurring_invoices_tenant_id"), table_name="recurring_invoices")
    op.drop_table("recurring_invoices")
