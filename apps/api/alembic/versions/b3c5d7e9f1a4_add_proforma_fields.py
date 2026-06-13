"""add final payment factor, proforma header fields, and tenant bank/contact fields

Revision ID: b3c5d7e9f1a4
Revises: 97176ba7d53f
Create Date: 2026-06-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b3c5d7e9f1a4"
down_revision = "97176ba7d53f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoice_line_items",
        sa.Column("final_payment_factor", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column("invoices", sa.Column("lpo_no", sa.String(64), nullable=True))
    op.add_column("invoices", sa.Column("project_villa_no", sa.String(128), nullable=True))
    op.add_column("invoices", sa.Column("bill_to_address", sa.String(500), nullable=True))
    op.add_column("invoices", sa.Column("ship_to_address", sa.String(500), nullable=True))
    op.add_column("tenants", sa.Column("cheque_payee_name", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("bank_name", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("bank_account_number", sa.String(64), nullable=True))
    op.add_column("tenants", sa.Column("bank_iban", sa.String(64), nullable=True))
    op.add_column("tenants", sa.Column("contact_person", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("contact_phone", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "contact_phone")
    op.drop_column("tenants", "contact_person")
    op.drop_column("tenants", "bank_iban")
    op.drop_column("tenants", "bank_account_number")
    op.drop_column("tenants", "bank_name")
    op.drop_column("tenants", "cheque_payee_name")
    op.drop_column("invoices", "ship_to_address")
    op.drop_column("invoices", "bill_to_address")
    op.drop_column("invoices", "project_villa_no")
    op.drop_column("invoices", "lpo_no")
    op.drop_column("invoice_line_items", "final_payment_factor")
