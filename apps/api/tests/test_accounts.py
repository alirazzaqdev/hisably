import uuid


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


async def test_account_transfer_moves_balance(client, auth_headers):
    cash_resp = await client.post(
        "/api/v1/accounts", json={"name": "Cash Drawer", "type": "cash", "opening_balance": "500.00"}, headers=auth_headers
    )
    cash = cash_resp.json()
    bank_resp = await client.post(
        "/api/v1/accounts", json={"name": "Main Bank", "type": "bank", "opening_balance": "0.00"}, headers=auth_headers
    )
    bank = bank_resp.json()

    transfer_resp = await client.post(
        "/api/v1/accounts/transfers",
        json={
            "from_account_id": cash["id"],
            "to_account_id": bank["id"],
            "amount": "200.00",
            "transfer_date": "2026-06-15",
            "notes": "Deposit cash to bank",
        },
        headers=auth_headers,
    )
    assert transfer_resp.status_code == 201
    transfer = transfer_resp.json()
    assert transfer["amount"] == "200.00"

    cash_after = await client.get(f"/api/v1/accounts/{cash['id']}", headers=auth_headers)
    assert cash_after.json()["current_balance"] == "300.00"
    bank_after = await client.get(f"/api/v1/accounts/{bank['id']}", headers=auth_headers)
    assert bank_after.json()["current_balance"] == "200.00"

    list_resp = await client.get("/api/v1/accounts/transfers", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    list_for_bank = await client.get(
        "/api/v1/accounts/transfers", params={"account_id": bank["id"]}, headers=auth_headers
    )
    assert len(list_for_bank.json()) == 1

    same_account_resp = await client.post(
        "/api/v1/accounts/transfers",
        json={
            "from_account_id": cash["id"],
            "to_account_id": cash["id"],
            "amount": "10.00",
            "transfer_date": "2026-06-15",
        },
        headers=auth_headers,
    )
    assert same_account_resp.status_code == 400


async def test_account_statement(client, auth_headers):
    cash_resp = await client.post(
        "/api/v1/accounts", json={"name": "Cash Drawer", "type": "cash", "opening_balance": "100.00"}, headers=auth_headers
    )
    cash = cash_resp.json()
    bank_resp = await client.post(
        "/api/v1/accounts", json={"name": "Main Bank", "type": "bank", "opening_balance": "0.00"}, headers=auth_headers
    )
    bank = bank_resp.json()

    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")

    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "account_id": cash["id"],
            "amount": "50.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice["id"], "amount": "50.00"}],
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/accounts/transfers",
        json={
            "from_account_id": cash["id"],
            "to_account_id": bank["id"],
            "amount": "30.00",
            "transfer_date": "2026-06-10",
            "notes": "Deposit",
        },
        headers=auth_headers,
    )

    statement_resp = await client.get(f"/api/v1/accounts/{cash['id']}/statement", headers=auth_headers)
    assert statement_resp.status_code == 200
    statement = statement_resp.json()
    assert statement["opening_balance"] == "100.00"
    assert statement["closing_balance"] == "120.00"
    assert len(statement["entries"]) == 2
    assert statement["entries"][0]["amount_in"] == "50.00"
    assert statement["entries"][0]["balance"] == "150.00"
    assert statement["entries"][1]["amount_out"] == "30.00"
    assert statement["entries"][1]["balance"] == "120.00"

    filtered_resp = await client.get(
        f"/api/v1/accounts/{cash['id']}/statement",
        params={"date_from": "2026-06-08", "date_to": "2026-06-15"},
        headers=auth_headers,
    )
    filtered = filtered_resp.json()
    assert filtered["opening_balance"] == "150.00"
    assert len(filtered["entries"]) == 1
    assert filtered["closing_balance"] == "120.00"

    pdf_resp = await client.get(f"/api/v1/accounts/{cash['id']}/statement/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"

    csv_resp = await client.get(f"/api/v1/accounts/{cash['id']}/statement/csv", headers=auth_headers)
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"].startswith("text/csv")
    assert b"Opening balance" in csv_resp.content
    assert b"Closing balance" in csv_resp.content

    not_found_resp = await client.get(f"/api/v1/accounts/{uuid.uuid4()}/statement", headers=auth_headers)
    assert not_found_resp.status_code == 404
