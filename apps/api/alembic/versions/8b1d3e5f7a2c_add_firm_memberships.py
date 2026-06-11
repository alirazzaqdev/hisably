"""add firm_memberships table

Revision ID: 8b1d3e5f7a2c
Revises: 6a7b8c9d0e1f
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b1d3e5f7a2c"
down_revision = "6a7b8c9d0e1f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "firm_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tenant_id", name="uq_firm_membership_user_tenant"),
    )
    op.create_index(op.f("ix_firm_memberships_user_id"), "firm_memberships", ["user_id"], unique=False)
    op.create_index(op.f("ix_firm_memberships_tenant_id"), "firm_memberships", ["tenant_id"], unique=False)

    # Backfill: every existing owner gets a membership for their home tenant.
    op.execute(
        """
        INSERT INTO firm_memberships (id, user_id, tenant_id, created_at, updated_at)
        SELECT gen_random_uuid(), id, tenant_id, now(), now()
        FROM users
        WHERE role = 'owner'
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_firm_memberships_tenant_id"), table_name="firm_memberships")
    op.drop_index(op.f("ix_firm_memberships_user_id"), table_name="firm_memberships")
    op.drop_table("firm_memberships")
