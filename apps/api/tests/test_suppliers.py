async def test_supplier_crud_and_search(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/suppliers",
        json={"name": "Glass Supplier Co", "email": "sales@glasssupplier.test", "opening_balance": "200.00"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    supplier = create_resp.json()
    assert supplier["name"] == "Glass Supplier Co"
    assert supplier["opening_balance"] == "200.00"

    await client.post("/api/v1/suppliers", json={"name": "Aluminium Traders"}, headers=auth_headers)

    list_resp = await client.get("/api/v1/suppliers", headers=auth_headers)
    page = list_resp.json()
    assert page["total"] == 2

    search_resp = await client.get("/api/v1/suppliers", params={"search": "glass"}, headers=auth_headers)
    page = search_resp.json()
    assert page["total"] == 1
    assert page["items"][0]["name"] == "Glass Supplier Co"

    supplier_id = supplier["id"]
    get_resp = await client.get(f"/api/v1/suppliers/{supplier_id}", headers=auth_headers)
    assert get_resp.status_code == 200

    patch_resp = await client.patch(
        f"/api/v1/suppliers/{supplier_id}", json={"phone": "0501234567"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["phone"] == "0501234567"

    delete_resp = await client.delete(f"/api/v1/suppliers/{supplier_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_after_delete = await client.get(f"/api/v1/suppliers/{supplier_id}", headers=auth_headers)
    assert get_after_delete.status_code == 404


async def test_suppliers_require_auth(client):
    resp = await client.get("/api/v1/suppliers")
    assert resp.status_code == 401
