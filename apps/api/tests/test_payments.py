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
