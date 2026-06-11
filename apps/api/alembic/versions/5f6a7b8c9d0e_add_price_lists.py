"""add price lists, item prices, and customers.price_list_id

Revision ID: 5f6a7b8c9d0e
Revises: 4e5f6a7b8c9d
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5f6a7b8c9d0e"
down_revision = "4e5f6a7b8c9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "price_lists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_price_lists_tenant_id"), "price_lists", ["tenant_id"], unique=False)

    op.create_table(
        "item_prices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("price_list_id", sa.Uuid(), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["price_list_id"], ["price_lists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("item_id", "price_list_id", name="uq_item_prices_item_price_list"),
    )
    op.create_index(op.f("ix_item_prices_tenant_id"), "item_prices", ["tenant_id"], unique=False)

    op.add_column("customers", sa.Column("price_list_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_customers_price_list_id_price_lists",
        "customers",
        "price_lists",
        ["price_list_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_customers_price_list_id_price_lists", "customers", type_="foreignkey")
    op.drop_column("customers", "price_list_id")
    op.drop_index(op.f("ix_item_prices_tenant_id"), table_name="item_prices")
    op.drop_table("item_prices")
    op.drop_index(op.f("ix_price_lists_tenant_id"), table_name="price_lists")
    op.drop_table("price_lists")
