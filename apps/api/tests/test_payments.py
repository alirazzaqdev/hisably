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


async def test_payment_partial_and_full_allocation_updates_invoice_status(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")
    grand_total = invoice["grand_total"]
    invoice_id = invoice["id"]

    partial_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "50.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice_id, "amount": "50.00"}],
        },
        headers=auth_headers,
    )
    assert partial_resp.status_code == 201
    payment = partial_resp.json()
    assert payment["amount"] == "50.00"
    assert len(payment["allocations"]) == 1

    invoice_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp.json()["status"] == "partially_paid"

    remaining = str(invoice["grand_total"])
    second_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "55.00",
            "method": "bank_transfer",
            "payment_date": "2026-06-10",
            "allocations": [{"invoice_id": invoice_id, "amount": "55.00"}],
        },
        headers=auth_headers,
    )
    assert second_resp.status_code == 201

    invoice_resp2 = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp2.json()["status"] == "paid"

    list_resp = await client.get("/api/v1/payments", headers=auth_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 2

    assert grand_total == "105.00"


async def test_delete_payment_rolls_back_invoice_status(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")
    invoice_id = invoice["id"]

    payment_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "105.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice_id, "amount": "105.00"}],
        },
        headers=auth_headers,
    )
    payment_id = payment_resp.json()["id"]

    invoice_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp.json()["status"] == "paid"

    delete_resp = await client.delete(f"/api/v1/payments/{payment_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    invoice_resp2 = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp2.json()["status"] == "sent"


async def test_receivables_lists_unpaid_invoices(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="200.00")

    resp = await client.get("/api/v1/receivables", headers=auth_headers)
    assert resp.status_code == 200
    receivables = resp.json()
    assert len(receivables) == 1
    assert receivables[0]["invoice_id"] == invoice["id"]
    assert receivables[0]["balance_due"] == receivables[0]["grand_total"]


async def test_payments_require_auth(client):
    resp = await client.get("/api/v1/payments")
    assert resp.status_code == 401


async def test_cheque_payment_tracking_and_bounce(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")
    invoice_id = invoice["id"]

    payment_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "105.00",
            "method": "cheque",
            "cheque_number": "CHK-001",
            "cheque_date": "2026-06-20",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice_id, "amount": "105.00"}],
        },
        headers=auth_headers,
    )
    assert payment_resp.status_code == 201
    payment = payment_resp.json()
    assert payment["cheque_number"] == "CHK-001"
    assert payment["cheque_date"] == "2026-06-20"
    assert payment["cheque_status"] == "pending"

    invoice_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp.json()["status"] == "paid"

    bounce_resp = await client.patch(
        f"/api/v1/payments/{payment['id']}/cheque-status", json={"cheque_status": "bounced"}, headers=auth_headers
    )
    assert bounce_resp.status_code == 200
    assert bounce_resp.json()["cheque_status"] == "bounced"

    invoice_resp2 = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp2.json()["status"] == "sent"

    clear_resp = await client.patch(
        f"/api/v1/payments/{payment['id']}/cheque-status", json={"cheque_status": "cleared"}, headers=auth_headers
    )
    assert clear_resp.status_code == 200

    invoice_resp3 = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp3.json()["status"] == "paid"


async def test_void_payment_reverses_balance_and_invoice_status(client, auth_headers):
    account_resp = await client.post(
        "/api/v1/accounts", json={"name": "Cash Drawer", "type": "cash", "opening_balance": "0.00"}, headers=auth_headers
    )
    account = account_resp.json()

    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")
    invoice_id = invoice["id"]

    payment_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "account_id": account["id"],
            "amount": "105.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice_id, "amount": "105.00"}],
        },
        headers=auth_headers,
    )
    payment_id = payment_resp.json()["id"]

    account_resp2 = await client.get(f"/api/v1/accounts/{account['id']}", headers=auth_headers)
    assert account_resp2.json()["current_balance"] == "105.00"

    invoice_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp.json()["status"] == "paid"

    void_resp = await client.patch(
        f"/api/v1/payments/{payment_id}/void", json={"reason": "Entered by mistake"}, headers=auth_headers
    )
    assert void_resp.status_code == 200
    voided = void_resp.json()
    assert voided["voided_at"] is not None
    assert voided["void_reason"] == "Entered by mistake"

    account_resp3 = await client.get(f"/api/v1/accounts/{account['id']}", headers=auth_headers)
    assert account_resp3.json()["current_balance"] == "0.00"

    invoice_resp2 = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp2.json()["status"] == "sent"

    # A voided payment cannot be voided again or edited.
    revoid_resp = await client.patch(
        f"/api/v1/payments/{payment_id}/void", json={"reason": "Again"}, headers=auth_headers
    )
    assert revoid_resp.status_code == 400

    edit_resp = await client.patch(
        f"/api/v1/payments/{payment_id}", json={"notes": "Edit attempt"}, headers=auth_headers
    )
    assert edit_resp.status_code == 400


async def test_update_payment_fields(client, auth_headers):
    account_resp = await client.post(
        "/api/v1/accounts", json={"name": "Cash Drawer", "type": "cash", "opening_balance": "0.00"}, headers=auth_headers
    )
    account = account_resp.json()
    bank_resp = await client.post(
        "/api/v1/accounts", json={"name": "Main Bank", "type": "bank", "opening_balance": "0.00"}, headers=auth_headers
    )
    bank = bank_resp.json()

    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")

    payment_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "account_id": account["id"],
            "amount": "105.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "reference_no": "REF-1",
            "allocations": [{"invoice_id": invoice["id"], "amount": "105.00"}],
        },
        headers=auth_headers,
    )
    payment_id = payment_resp.json()["id"]

    update_resp = await client.patch(
        f"/api/v1/payments/{payment_id}",
        json={"account_id": bank["id"], "reference_no": "REF-2", "notes": "Updated note"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["account_id"] == bank["id"]
    assert updated["reference_no"] == "REF-2"
    assert updated["notes"] == "Updated note"

    cash_balance = await client.get(f"/api/v1/accounts/{account['id']}", headers=auth_headers)
    assert cash_balance.json()["current_balance"] == "0.00"
    bank_balance = await client.get(f"/api/v1/accounts/{bank['id']}", headers=auth_headers)
    assert bank_balance.json()["current_balance"] == "105.00"


async def test_payments_list_filters(client, auth_headers):
    account_resp = await client.post(
        "/api/v1/accounts", json={"name": "Cash Drawer", "type": "cash", "opening_balance": "0.00"}, headers=auth_headers
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
            "payment_date": "2026-06-05",
            "reference_no": "ABC-100",
            "allocations": [{"invoice_id": invoice["id"], "amount": "50.00"}],
        },
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "55.00",
            "method": "bank_transfer",
            "payment_date": "2026-06-12",
            "reference_no": "XYZ-200",
            "allocations": [{"invoice_id": invoice["id"], "amount": "55.00"}],
        },
        headers=auth_headers,
    )

    by_account = await client.get("/api/v1/payments", params={"account_id": account["id"]}, headers=auth_headers)
    assert by_account.json()["total"] == 1

    by_method = await client.get("/api/v1/payments", params={"method": "bank_transfer"}, headers=auth_headers)
    assert by_method.json()["total"] == 1

    by_date = await client.get(
        "/api/v1/payments", params={"date_from": "2026-06-10", "date_to": "2026-06-15"}, headers=auth_headers
    )
    assert by_date.json()["total"] == 1
    assert by_date.json()["items"][0]["reference_no"] == "XYZ-200"

    by_search = await client.get("/api/v1/payments", params={"search": "ABC"}, headers=auth_headers)
    assert by_search.json()["total"] == 1
    assert by_search.json()["items"][0]["reference_no"] == "ABC-100"


async def test_cheque_status_rejected_for_non_cheque_payment(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")

    payment_resp = await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "105.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice["id"], "amount": "105.00"}],
        },
        headers=auth_headers,
    )
    payment_id = payment_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/payments/{payment_id}/cheque-status", json={"cheque_status": "cleared"}, headers=auth_headers
    )
    assert resp.status_code == 400
