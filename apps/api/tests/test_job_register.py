async def _create_customer(client, auth_headers) -> str:
    resp = await client.post("/api/v1/customers", json={"name": "Al Hano Contracting"}, headers=auth_headers)
    return resp.json()["id"]


async def test_job_register_row_crud_and_vat_autocalc(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    create_resp = await client.post(
        "/api/v1/job-register/rows",
        json={
            "qt_no": "QT-001",
            "lpo_no": "LPO-100",
            "villa_no": "Villa 12",
            "description": "Aluminium partition",
            "rate": "1000.00",
            "customer_id": customer_id,
            "company_text": "Al Hano Contracting",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    row = create_resp.json()
    assert row["vat"] == "50.00"
    assert row["total"] == "1050.00"
    assert row["work_status"] == "not_completed"
    assert row["tax_invoice_status"] == "not_submitted"
    assert row["payment_status"] == "pending"

    row_id = row["id"]

    # Inline status edits
    patch_resp = await client.patch(
        f"/api/v1/job-register/rows/{row_id}",
        json={"work_status": "completed", "tax_invoice_status": "submitted", "payment_status": "received"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["work_status"] == "completed"
    assert updated["tax_invoice_status"] == "submitted"
    assert updated["payment_status"] == "received"

    # Override total
    override_resp = await client.patch(
        f"/api/v1/job-register/rows/{row_id}", json={"override_total": "1200.00"}, headers=auth_headers
    )
    assert override_resp.json()["total"] == "1200.00"

    # Changing rate recomputes VAT
    rate_resp = await client.patch(
        f"/api/v1/job-register/rows/{row_id}", json={"rate": "2000.00"}, headers=auth_headers
    )
    assert rate_resp.json()["vat"] == "100.00"
    # override_total persists until explicitly cleared
    assert rate_resp.json()["total"] == "1200.00"

    clear_resp = await client.patch(
        f"/api/v1/job-register/rows/{row_id}", json={"clear_override_total": True}, headers=auth_headers
    )
    assert clear_resp.json()["override_total"] is None
    assert clear_resp.json()["total"] == "2100.00"

    list_resp = await client.get("/api/v1/job-register/rows", headers=auth_headers)
    assert list_resp.json()["total"] == 1

    delete_resp = await client.delete(f"/api/v1/job-register/rows/{row_id}", headers=auth_headers)
    assert delete_resp.status_code == 204


async def test_job_register_filters_search_and_summary(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    await client.post(
        "/api/v1/job-register/rows",
        json={
            "description": "Glass facade",
            "villa_no": "Villa 5",
            "rate": "1000.00",
            "customer_id": customer_id,
            "tax_invoice_status": "submitted",
            "payment_status": "received",
        },
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/job-register/rows",
        json={
            "description": "Steel door",
            "villa_no": "Villa 9",
            "rate": "500.00",
            "payment_status": "pending",
        },
        headers=auth_headers,
    )

    search_resp = await client.get("/api/v1/job-register/rows", params={"search": "Villa 5"}, headers=auth_headers)
    assert search_resp.json()["total"] == 1
    assert search_resp.json()["items"][0]["description"] == "Glass facade"

    status_resp = await client.get(
        "/api/v1/job-register/rows", params={"payment_status": "pending"}, headers=auth_headers
    )
    assert status_resp.json()["total"] == 1
    assert status_resp.json()["items"][0]["description"] == "Steel door"

    summary_resp = await client.get("/api/v1/job-register/summary", headers=auth_headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["total_work_value"] == "1575.00"
    assert summary["total_submitted"] == "1050.00"
    assert summary["total_received_by_status"] == "1050.00"
    assert summary["total_received"] == "0.00"
    assert summary["balance"] == "1575.00"


async def test_job_receipts_log_and_total_received(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    await client.post(
        "/api/v1/job-register/rows",
        json={"description": "Glass facade", "rate": "1000.00", "customer_id": customer_id},
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/job-register/receipts",
        json={
            "customer_id": customer_id,
            "company_text": "Al Hano Contracting",
            "amount": "672.00",
            "receipt_date": "2026-02-17",
            "note": "Received-01",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    receipt = create_resp.json()
    assert receipt["amount"] == "672.00"

    list_resp = await client.get("/api/v1/job-register/receipts", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    summary_resp = await client.get("/api/v1/job-register/summary", headers=auth_headers)
    summary = summary_resp.json()
    assert summary["total_received"] == "672.00"
    assert summary["balance"] == "378.00"

    update_resp = await client.patch(
        f"/api/v1/job-register/receipts/{receipt['id']}", json={"amount": "700.00"}, headers=auth_headers
    )
    assert update_resp.json()["amount"] == "700.00"

    delete_resp = await client.delete(f"/api/v1/job-register/receipts/{receipt['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204
