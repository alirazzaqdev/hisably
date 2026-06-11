async def test_backup_export_and_import_round_trip(client, auth_headers):
    item_resp = await client.post(
        "/api/v1/items",
        json={"name": "Glass Sheet", "sku": "GLS-200", "sale_price": "100.00", "purchase_price": "60.00"},
        headers=auth_headers,
    )
    item_id = item_resp.json()["id"]

    customer_resp = await client.post("/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers)
    customer_id = customer_resp.json()["id"]

    invoice_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "line_items": [
                {"item_id": item_id, "description": "Glass Sheet", "quantity": "1", "unit_price": "100.00", "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    invoice_id = invoice_resp.json()["id"]

    export_resp = await client.get("/api/v1/backup/export", headers=auth_headers)
    assert export_resp.status_code == 200
    backup = export_resp.json()
    assert len(backup["items"]) == 1
    assert len(backup["customers"]) == 1
    assert len(backup["invoices"]) == 1
    assert len(backup["invoice_line_items"]) == 1

    import_resp = await client.post("/api/v1/backup/import", json=backup, headers=auth_headers)
    assert import_resp.status_code == 200

    items_resp = await client.get("/api/v1/items", headers=auth_headers)
    assert items_resp.json()["total"] == 1
    assert items_resp.json()["items"][0]["id"] == item_id

    customers_resp = await client.get("/api/v1/customers", headers=auth_headers)
    assert customers_resp.json()["total"] == 1
    assert customers_resp.json()["items"][0]["id"] == customer_id

    invoice_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert invoice_resp.status_code == 200
    assert len(invoice_resp.json()["line_items"]) == 1


async def test_backup_requires_owner(client):
    resp = await client.get("/api/v1/backup/export")
    assert resp.status_code == 401
