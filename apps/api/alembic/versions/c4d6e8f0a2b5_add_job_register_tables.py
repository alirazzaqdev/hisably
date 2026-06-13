"""add job register tables

Revision ID: c4d6e8f0a2b5
Revises: b3c5d7e9f1a4
Create Date: 2026-06-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4d6e8f0a2b5"
down_revision = "b3c5d7e9f1a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_register_rows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("qt_no", sa.String(length=100), nullable=True),
        sa.Column("quotation_id", sa.Uuid(), nullable=True),
        sa.Column("lpo_no", sa.String(length=100), nullable=True),
        sa.Column("villa_no", sa.String(length=100), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("rate", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("vat", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("override_total", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("company_text", sa.String(length=255), nullable=True),
        sa.Column(
            "work_status",
            sa.Enum("NOT_COMPLETED", "IN_PROGRESS", "COMPLETED", name="jobworkstatus", native_enum=False),
            nullable=False,
            server_default="NOT_COMPLETED",
        ),
        sa.Column(
            "tax_invoice_status",
            sa.Enum("NOT_SUBMITTED", "SUBMITTED", name="jobtaxinvoicestatus", native_enum=False),
            nullable=False,
            server_default="NOT_SUBMITTED",
        ),
        sa.Column(
            "payment_status",
            sa.Enum(
                "LPO_NOT_RECEIVED", "PENDING", "RECEIVED", "NOT_RECEIVED", name="jobpaymentstatus", native_enum=False
            ),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("remarks", sa.String(length=1000), nullable=True),
        sa.Column("source_invoice_id", sa.Uuid(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("client_uuid", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["quotation_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["source_invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_uuid"),
    )
    op.create_index(op.f("ix_job_register_rows_tenant_id"), "job_register_rows", ["tenant_id"], unique=False)
    op.alter_column("job_register_rows", "rate", server_default=None)
    op.alter_column("job_register_rows", "vat", server_default=None)
    op.alter_column("job_register_rows", "work_status", server_default=None)
    op.alter_column("job_register_rows", "tax_invoice_status", server_default=None)
    op.alter_column("job_register_rows", "payment_status", server_default=None)
    op.alter_column("job_register_rows", "sort_order", server_default=None)

    op.create_table(
        "job_receipts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("company_text", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("receipt_date", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=1000), nullable=True),
        sa.Column("linked_payment_id", sa.Uuid(), nullable=True),
        sa.Column("client_uuid", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["linked_payment_id"], ["payments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_uuid"),
    )
    op.create_index(op.f("ix_job_receipts_tenant_id"), "job_receipts", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_job_receipts_tenant_id"), table_name="job_receipts")
    op.drop_table("job_receipts")
    op.drop_index(op.f("ix_job_register_rows_tenant_id"), table_name="job_register_rows")
    op.drop_table("job_register_rows")
