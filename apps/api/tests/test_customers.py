async def test_customer_crud_and_search(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/customers",
        json={"name": "Acme Trading", "email": "billing@acme.test", "opening_balance": "100.50"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    customer = create_resp.json()
    assert customer["name"] == "Acme Trading"
    assert customer["opening_balance"] == "100.50"

    await client.post("/api/v1/customers", json={"name": "Falcon Glass"}, headers=auth_headers)

    list_resp = await client.get("/api/v1/customers", headers=auth_headers)
    assert list_resp.status_code == 200
    page = list_resp.json()
    assert page["total"] == 2
    assert {c["name"] for c in page["items"]} == {"Acme Trading", "Falcon Glass"}

    search_resp = await client.get("/api/v1/customers", params={"search": "acme"}, headers=auth_headers)
    page = search_resp.json()
    assert page["total"] == 1
    assert page["items"][0]["name"] == "Acme Trading"

    customer_id = customer["id"]
    get_resp = await client.get(f"/api/v1/customers/{customer_id}", headers=auth_headers)
    assert get_resp.status_code == 200

    patch_resp = await client.patch(
        f"/api/v1/customers/{customer_id}", json={"phone": "0501234567"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["phone"] == "0501234567"

    delete_resp = await client.delete(f"/api/v1/customers/{customer_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_after_delete = await client.get(f"/api/v1/customers/{customer_id}", headers=auth_headers)
    assert get_after_delete.status_code == 404


async def test_customers_require_auth(client):
    resp = await client.get("/api/v1/customers")
    assert resp.status_code == 401
