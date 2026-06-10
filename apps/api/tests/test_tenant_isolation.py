"""Proves the schema/query pattern that the future repository layer must
follow: every query on a tenant-scoped table is filtered by tenant_id, so
one tenant can never see another tenant's rows — even if a record's primary
key is known.
"""

from sqlalchemy import select

from app.models import Customer, Tenant


async def test_customer_query_is_isolated_by_tenant_id(db_session):
    tenant_a = Tenant(business_name="Acme Trading")
    tenant_b = Tenant(business_name="Falcon Glass")
    db_session.add_all([tenant_a, tenant_b])
    await db_session.flush()

    db_session.add_all(
        [
            Customer(tenant_id=tenant_a.id, name="Customer A1"),
            Customer(tenant_id=tenant_a.id, name="Customer A2"),
            Customer(tenant_id=tenant_b.id, name="Customer B1"),
        ]
    )
    await db_session.commit()

    result = await db_session.execute(select(Customer).where(Customer.tenant_id == tenant_a.id))
    tenant_a_customers = result.scalars().all()

    assert {c.name for c in tenant_a_customers} == {"Customer A1", "Customer A2"}
    assert all(c.tenant_id == tenant_a.id for c in tenant_a_customers)

    result = await db_session.execute(select(Customer).where(Customer.tenant_id == tenant_b.id))
    tenant_b_customers = result.scalars().all()
    assert {c.name for c in tenant_b_customers} == {"Customer B1"}
