"""add quotation status to invoices

Revision ID: e5a7b9c1d3f0
Revises: d4f6a8c0e2b7
Create Date: 2026-06-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e5a7b9c1d3f0"
down_revision = "d4f6a8c0e2b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column(
            "quotation_status",
            sa.Enum("DRAFT", "PENDING", "APPROVED", "REJECTED", "EXPIRED", native_enum=False, name="quotationstatus"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE invoices SET quotation_status = 'DRAFT' WHERE type = 'QUOTATION' AND status = 'DRAFT'"
    )
    op.execute(
        "UPDATE invoices SET quotation_status = 'PENDING' WHERE type = 'QUOTATION' AND status != 'DRAFT'"
    )


def downgrade() -> None:
    op.drop_column("invoices", "quotation_status")
