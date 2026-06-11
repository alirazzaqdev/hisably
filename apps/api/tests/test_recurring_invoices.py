async def _create_customer(client, auth_headers) -> str:
    resp = await client.post("/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers)
    return resp.json()["id"]


async def test_recurring_invoice_create_and_generate_now(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    create_resp = await client.post(
        "/api/v1/recurring-invoices",
        json={
            "customer_id": customer_id,
            "frequency": "monthly",
            "start_date": "2026-06-01",
            "line_items": [
                {"description": "Monthly maintenance", "quantity": "1", "unit_price": "100.00", "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    recurring = create_resp.json()
    assert recurring["next_run_date"] == "2026-06-01"
    assert recurring["is_active"] is True

    generate_resp = await client.post(
        f"/api/v1/recurring-invoices/{recurring['id']}/generate-now", headers=auth_headers
    )
    assert generate_resp.status_code == 201
    invoice = generate_resp.json()
    assert invoice["customer_id"] == customer_id
    assert invoice["issue_date"] == "2026-06-01"
    assert invoice["grand_total"] == "105.00"
    assert invoice["line_items"][0]["description"] == "Monthly maintenance"

    get_resp = await client.get(f"/api/v1/recurring-invoices/{recurring['id']}", headers=auth_headers)
    updated = get_resp.json()
    assert updated["next_run_date"] == "2026-07-01"
    assert updated["last_generated_invoice_id"] == invoice["id"]


async def test_recurring_invoice_run_due(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    create_resp = await client.post(
        "/api/v1/recurring-invoices",
        json={
            "customer_id": customer_id,
            "frequency": "weekly",
            "start_date": "2020-01-01",
            "line_items": [
                {"description": "Weekly service", "quantity": "1", "unit_price": "50.00", "vat_category": "zero_rated"},
            ],
        },
        headers=auth_headers,
    )
    recurring_id = create_resp.json()["id"]

    run_resp = await client.post("/api/v1/recurring-invoices/run-due", headers=auth_headers)
    assert run_resp.status_code == 200
    invoices = run_resp.json()
    assert len(invoices) == 1
    assert invoices[0]["customer_id"] == customer_id

    get_resp = await client.get(f"/api/v1/recurring-invoices/{recurring_id}", headers=auth_headers)
    updated = get_resp.json()
    assert updated["next_run_date"] == "2020-01-08"


async def test_recurring_invoice_update_and_delete(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    create_resp = await client.post(
        "/api/v1/recurring-invoices",
        json={
            "customer_id": customer_id,
            "frequency": "yearly",
            "start_date": "2026-01-01",
            "line_items": [
                {"description": "Annual subscription", "quantity": "1", "unit_price": "1200.00", "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    recurring_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/recurring-invoices/{recurring_id}", json={"is_active": False}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_active"] is False

    generate_resp = await client.post(
        f"/api/v1/recurring-invoices/{recurring_id}/generate-now", headers=auth_headers
    )
    assert generate_resp.status_code == 400

    delete_resp = await client.delete(f"/api/v1/recurring-invoices/{recurring_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/recurring-invoices/{recurring_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_recurring_invoices_require_auth(client):
    resp = await client.get("/api/v1/recurring-invoices")
    assert resp.status_code == 401
