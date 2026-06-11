import uuid


async def test_push_creates_entity_and_is_idempotent(client, auth_headers):
    client_uuid = str(uuid.uuid4())

    resp = await client.post(
        "/api/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "customer",
                    "client_uuid": client_uuid,
                    "data": {"name": "Offline Customer"},
                }
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) == 1
    result = body["results"][0]
    assert result["status"] == "applied"
    assert result["client_uuid"] == client_uuid
    entity_id = result["entity_id"]

    list_resp = await client.get("/api/v1/customers", headers=auth_headers)
    assert list_resp.json()["total"] == 1

    replay_resp = await client.post(
        "/api/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "customer",
                    "client_uuid": client_uuid,
                    "data": {"name": "Offline Customer"},
                }
            ]
        },
        headers=auth_headers,
    )
    assert replay_resp.status_code == 200
    replay_result = replay_resp.json()["results"][0]
    assert replay_result["status"] == "duplicate"
    assert replay_result["entity_id"] == entity_id

    list_resp2 = await client.get("/api/v1/customers", headers=auth_headers)
    assert list_resp2.json()["total"] == 1


async def test_push_multiple_entity_types(client, auth_headers):
    resp = await client.post(
        "/api/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "item",
                    "client_uuid": str(uuid.uuid4()),
                    "data": {"name": "Offline Item", "sale_price": "10.00"},
                },
                {
                    "entity_type": "expense",
                    "client_uuid": str(uuid.uuid4()),
                    "data": {"category": "Fuel", "amount": "50.00", "expense_date": "2026-06-01"},
                },
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert all(r["status"] == "applied" for r in results)

    items_resp = await client.get("/api/v1/items", headers=auth_headers)
    assert items_resp.json()["total"] == 1

    expenses_resp = await client.get("/api/v1/expenses", headers=auth_headers)
    assert expenses_resp.json()["total"] == 1


async def test_pull_returns_changes_since_timestamp(client, auth_headers):
    pull_resp = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert pull_resp.status_code == 200
    initial = pull_resp.json()
    assert initial["customers"] == []
    server_time = initial["server_time"]

    await client.post("/api/v1/customers", json={"name": "New Customer"}, headers=auth_headers)

    full_pull = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert len(full_pull.json()["customers"]) == 1

    since_pull = await client.get("/api/v1/sync/pull", params={"since": server_time}, headers=auth_headers)
    assert len(since_pull.json()["customers"]) == 1


async def test_push_invoice_and_payment(client, auth_headers):
    customer_resp = await client.post("/api/v1/customers", json={"name": "Sync Customer"}, headers=auth_headers)
    customer_id = customer_resp.json()["id"]

    invoice_client_uuid = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "invoice",
                    "client_uuid": invoice_client_uuid,
                    "data": {
                        "customer_id": customer_id,
                        "issue_date": "2026-06-11",
                        "line_items": [
                            {"description": "Offline Item", "quantity": "1", "unit_price": "100.00", "vat_category": "standard"},
                        ],
                    },
                }
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    invoice_result = resp.json()["results"][0]
    assert invoice_result["status"] == "applied"
    invoice_id = invoice_result["entity_id"]

    invoices_resp = await client.get("/api/v1/invoices", headers=auth_headers)
    assert invoices_resp.json()["total"] == 1

    payment_client_uuid = str(uuid.uuid4())
    payment_resp = await client.post(
        "/api/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "payment",
                    "client_uuid": payment_client_uuid,
                    "data": {
                        "customer_id": customer_id,
                        "amount": "105.00",
                        "method": "cash",
                        "payment_date": "2026-06-11",
                        "allocations": [{"invoice_id": invoice_id, "amount": "105.00"}],
                    },
                }
            ]
        },
        headers=auth_headers,
    )
    assert payment_resp.status_code == 200
    payment_result = payment_resp.json()["results"][0]
    assert payment_result["status"] == "applied"

    payments_resp = await client.get("/api/v1/payments", headers=auth_headers)
    assert payments_resp.json()["total"] == 1

    # Replaying the same mutations is idempotent.
    replay_resp = await client.post(
        "/api/v1/sync/push",
        json={
            "mutations": [
                {
                    "entity_type": "invoice",
                    "client_uuid": invoice_client_uuid,
                    "data": {
                        "customer_id": customer_id,
                        "issue_date": "2026-06-11",
                        "line_items": [
                            {"description": "Offline Item", "quantity": "1", "unit_price": "100.00", "vat_category": "standard"},
                        ],
                    },
                }
            ]
        },
        headers=auth_headers,
    )
    assert replay_resp.json()["results"][0]["status"] == "duplicate"
    invoices_resp = await client.get("/api/v1/invoices", headers=auth_headers)
    assert invoices_resp.json()["total"] == 1


async def test_sync_requires_auth(client):
    push_resp = await client.post("/api/v1/sync/push", json={"mutations": []})
    assert push_resp.status_code == 401

    pull_resp = await client.get("/api/v1/sync/pull")
    assert pull_resp.status_code == 401
