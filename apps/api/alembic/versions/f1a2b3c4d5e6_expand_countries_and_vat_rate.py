"""expand supported countries and add tenant vat_rate

Revision ID: f1a2b3c4d5e6
Revises: d7f9b1c3e5a4
Create Date: 2026-06-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "d7f9b1c3e5a4"
branch_labels = None
depends_on = None

COUNTRY_CODES = [
    "AE", "SA", "PK", "IN", "US", "GB", "CA", "AU", "DE", "FR", "IT", "ES", "NL", "BE", "CH",
    "SE", "NO", "DK", "FI", "PL", "PT", "IE", "AT", "GR", "TR", "EG", "QA", "KW", "BH", "OM",
    "JO", "LB", "CN", "JP", "KR", "SG", "MY", "ID", "TH", "PH", "VN", "BD", "NZ", "ZA", "NG",
    "KE", "MA", "TN", "MX", "IL",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        constraints = bind.execute(
            sa.text(
                """
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_attribute att ON att.attrelid = rel.oid
                WHERE rel.relname = 'tenants' AND con.contype = 'c' AND att.attname = 'country'
                  AND att.attnum = ANY(con.conkey)
                """
            )
        ).fetchall()
        for (conname,) in constraints:
            op.execute(f'ALTER TABLE tenants DROP CONSTRAINT "{conname}"')

        codes = ", ".join(f"'{c}'" for c in COUNTRY_CODES)
        op.execute(f"ALTER TABLE tenants ADD CONSTRAINT ck_tenants_country CHECK (country IN ({codes}))")

    op.add_column("tenants", sa.Column("vat_rate", sa.Numeric(precision=5, scale=2), nullable=False, server_default="5"))


def downgrade() -> None:
    op.drop_column("tenants", "vat_rate")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS ck_tenants_country')
        op.execute("ALTER TABLE tenants ADD CONSTRAINT country CHECK (country IN ('AE', 'SA', 'PK'))")
