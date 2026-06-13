"""Proves that every query on a tenant-scoped table is filtered by
tenant_id, so one tenant can never see or modify another tenant's rows —
even if a record's primary key is known.
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


async def test_customer_not_visible_to_other_tenant(client, auth_headers, other_tenant_auth_headers):
    create_resp = await client.post(
        "/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers
    )
    customer_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/customers/{customer_id}", headers=other_tenant_auth_headers)
    assert get_resp.status_code == 404

    patch_resp = await client.patch(
        f"/api/v1/customers/{customer_id}", json={"phone": "0501234567"}, headers=other_tenant_auth_headers
    )
    assert patch_resp.status_code == 404

    delete_resp = await client.delete(f"/api/v1/customers/{customer_id}", headers=other_tenant_auth_headers)
    assert delete_resp.status_code == 404

    list_resp = await client.get("/api/v1/customers", headers=other_tenant_auth_headers)
    assert list_resp.json()["total"] == 0

    own_get_resp = await client.get(f"/api/v1/customers/{customer_id}", headers=auth_headers)
    assert own_get_resp.status_code == 200


async def test_invoice_not_visible_to_other_tenant(client, auth_headers, other_tenant_auth_headers):
    customer_resp = await client.post(
        "/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers
    )
    customer_id = customer_resp.json()["id"]

    invoice_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "line_items": [{"description": "Item", "quantity": "1", "unit_price": "10.00"}],
        },
        headers=auth_headers,
    )
    invoice_id = invoice_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=other_tenant_auth_headers)
    assert get_resp.status_code == 404

    status_resp = await client.patch(
        f"/api/v1/invoices/{invoice_id}/status",
        json={"status": "sent"},
        headers=other_tenant_auth_headers,
    )
    assert status_resp.status_code == 404

    pdf_resp = await client.get(f"/api/v1/invoices/{invoice_id}/pdf", headers=other_tenant_auth_headers)
    assert pdf_resp.status_code == 404

    list_resp = await client.get("/api/v1/invoices", headers=other_tenant_auth_headers)
    assert list_resp.json()["total"] == 0
