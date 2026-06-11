async def test_expense_crud(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/expenses",
        json={
            "category": "Rent",
            "amount": "1500.00",
            "vat_paid": "75.00",
            "expense_date": "2026-06-01",
            "notes": "Office rent for June",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    expense = create_resp.json()
    assert expense["category"] == "Rent"
    assert expense["amount"] == "1500.00"
    assert expense["vat_paid"] == "75.00"

    await client.post(
        "/api/v1/expenses",
        json={"category": "Utilities", "amount": "200.00", "expense_date": "2026-06-02"},
        headers=auth_headers,
    )

    list_resp = await client.get("/api/v1/expenses", headers=auth_headers)
    assert list_resp.status_code == 200
    page = list_resp.json()
    assert page["total"] == 2

    filtered_resp = await client.get("/api/v1/expenses", params={"category": "Rent"}, headers=auth_headers)
    assert filtered_resp.json()["total"] == 1

    expense_id = expense["id"]
    get_resp = await client.get(f"/api/v1/expenses/{expense_id}", headers=auth_headers)
    assert get_resp.status_code == 200

    patch_resp = await client.patch(
        f"/api/v1/expenses/{expense_id}", json={"amount": "1600.00"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["amount"] == "1600.00"

    delete_resp = await client.delete(f"/api/v1/expenses/{expense_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    final_resp = await client.get("/api/v1/expenses", headers=auth_headers)
    assert final_resp.json()["total"] == 1


async def test_expenses_require_auth(client):
    resp = await client.get("/api/v1/expenses")
    assert resp.status_code == 401


async def test_expense_with_attachment(client, auth_headers):
    upload_resp = await client.post(
        "/api/v1/attachments",
        files={"file": ("receipt.png", b"fake-image-bytes", "image/png")},
        data={"entity_type": "expense"},
        headers=auth_headers,
    )
    assert upload_resp.status_code == 201
    attachment = upload_resp.json()
    assert attachment["file_type"] == "image/png"
    assert attachment["file_url"].startswith("data:image/png;base64,")

    create_resp = await client.post(
        "/api/v1/expenses",
        json={
            "category": "Fuel",
            "amount": "100.00",
            "expense_date": "2026-06-03",
            "attachment_id": attachment["id"],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    expense = create_resp.json()
    assert expense["attachment_id"] == attachment["id"]
    assert expense["attachment_url"] == attachment["file_url"]

    get_resp = await client.get(f"/api/v1/expenses/{expense['id']}", headers=auth_headers)
    assert get_resp.json()["attachment_url"] == attachment["file_url"]


async def test_attachment_upload_rejects_unsupported_type(client, auth_headers):
    resp = await client.post(
        "/api/v1/attachments",
        files={"file": ("notes.txt", b"hello", "text/plain")},
        data={"entity_type": "expense"},
        headers=auth_headers,
    )
    assert resp.status_code == 415
