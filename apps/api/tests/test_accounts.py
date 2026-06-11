async def _create_customer(client, auth_headers) -> str:
    resp = await client.post("/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers)
    return resp.json()["id"]


async def _create_invoice(client, auth_headers, customer_id: str, unit_price: str = "100.00") -> dict:
    resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "line_items": [
                {"description": "Glass panel", "quantity": "1", "unit_price": unit_price, "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    invoice = resp.json()
    await client.patch(f"/api/v1/invoices/{invoice['id']}/status", json={"status": "sent"}, headers=auth_headers)
    return invoice


async def test_account_crud(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Main Bank", "type": "bank", "bank_name": "ENBD", "account_number": "12345", "opening_balance": "1000.00"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    account = create_resp.json()
    assert account["name"] == "Main Bank"
    assert account["current_balance"] == "1000.00"

    list_resp = await client.get("/api/v1/accounts", headers=auth_headers)
    assert list_resp.status_code == 200
    accounts = list_resp.json()
    assert any(a["id"] == account["id"] for a in accounts)

    patch_resp = await client.patch(
        f"/api/v1/accounts/{account['id']}", json={"name": "Main Bank Account"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Main Bank Account"

    delete_resp = await client.delete(f"/api/v1/accounts/{account['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_after_delete = await client.get(f"/api/v1/accounts/{account['id']}", headers=auth_headers)
    assert get_after_delete.status_code == 404


async def test_accounts_require_auth(client):
    resp = await client.get("/api/v1/accounts")
    assert resp.status_code == 401


async def test_payment_updates_account_balance(client, auth_headers):
    account_resp = await client.post(
        "/api/v1/accounts", json={"name": "Cash Drawer", "type": "cash", "opening_balance": "100.00"}, headers=auth_headers
    )
    account = account_resp.json()

    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")

    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "account_id": account["id"],
            "amount": "50.00",
            "method": "cash",
            "payment_date": "2026-06-10",
            "allocations": [{"invoice_id": invoice["id"], "amount": "50.00"}],
        },
        headers=auth_headers,
    )

    get_resp = await client.get(f"/api/v1/accounts/{account['id']}", headers=auth_headers)
    assert get_resp.json()["current_balance"] == "150.00"
