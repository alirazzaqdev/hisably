async def test_item_crud_and_search(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Glass partition", "sku": "GLS-001", "unit": "sqm", "sale_price": "150.00"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    item = create_resp.json()
    assert item["name"] == "Glass partition"
    assert item["sale_price"] == "150.00"

    await client.post("/api/v1/items", json={"name": "Installation service"}, headers=auth_headers)

    list_resp = await client.get("/api/v1/items", headers=auth_headers)
    assert list_resp.status_code == 200
    page = list_resp.json()
    assert page["total"] == 2

    search_resp = await client.get("/api/v1/items", params={"search": "GLS"}, headers=auth_headers)
    page = search_resp.json()
    assert page["total"] == 1
    assert page["items"][0]["name"] == "Glass partition"

    item_id = item["id"]
    patch_resp = await client.patch(
        f"/api/v1/items/{item_id}", json={"sale_price": "175.00"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["sale_price"] == "175.00"

    delete_resp = await client.delete(f"/api/v1/items/{item_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_after_delete = await client.get(f"/api/v1/items/{item_id}", headers=auth_headers)
    assert get_after_delete.status_code == 404


async def test_items_require_auth(client):
    resp = await client.get("/api/v1/items")
    assert resp.status_code == 401


async def test_item_lookup_by_barcode(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Aluminium profile", "barcode": "1234567890123"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    item = create_resp.json()
    assert item["barcode"] == "1234567890123"

    found_resp = await client.get("/api/v1/items/by-barcode/1234567890123", headers=auth_headers)
    assert found_resp.status_code == 200
    assert found_resp.json()["id"] == item["id"]

    missing_resp = await client.get("/api/v1/items/by-barcode/nope", headers=auth_headers)
    assert missing_resp.status_code == 404


async def test_low_stock_items(client, auth_headers):
    await client.post(
        "/api/v1/items",
        json={
            "name": "Aluminium frame",
            "sku": "ALU-001",
            "track_inventory": True,
            "current_stock": "5",
            "low_stock_threshold": "10",
        },
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/items",
        json={
            "name": "Glass sheet",
            "sku": "GLS-002",
            "track_inventory": True,
            "current_stock": "50",
            "low_stock_threshold": "10",
        },
        headers=auth_headers,
    )
    await client.post("/api/v1/items", json={"name": "Untracked item"}, headers=auth_headers)

    resp = await client.get("/api/v1/items/low-stock", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Aluminium frame"
