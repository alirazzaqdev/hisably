async def _create_customer(client, auth_headers, opening_balance: str = "0") -> str:
    resp = await client.post(
        "/api/v1/customers",
        json={"name": "Acme Trading", "opening_balance": opening_balance},
        headers=auth_headers,
    )
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


async def test_customer_statement_includes_invoices_and_payments(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers, opening_balance="50.00")
    invoice = await _create_invoice(client, auth_headers, customer_id, unit_price="100.00")

    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "50.00",
            "method": "cash",
            "payment_date": "2026-06-10",
            "allocations": [{"invoice_id": invoice["id"], "amount": "50.00"}],
        },
        headers=auth_headers,
    )

    resp = await client.get(f"/api/v1/customers/{customer_id}/statement", headers=auth_headers)
    assert resp.status_code == 200
    statement = resp.json()
    assert statement["opening_balance"] == "50.00"
    assert len(statement["entries"]) == 2

    invoice_entry = next(e for e in statement["entries"] if e["type"] == "invoice")
    assert invoice_entry["debit"] == "105.00"

    payment_entry = next(e for e in statement["entries"] if e["type"] == "payment")
    assert payment_entry["credit"] == "50.00"

    # 50 (opening) + 105 (invoice) - 50 (payment) = 105
    assert statement["closing_balance"] == "105.00"


async def test_supplier_statement_requires_auth(client):
    resp = await client.get("/api/v1/suppliers/00000000-0000-0000-0000-000000000000/statement")
    assert resp.status_code == 401
