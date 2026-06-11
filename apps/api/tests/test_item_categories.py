async def test_item_category_crud_and_filter(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/item-categories", json={"name": "Glass"}, headers=auth_headers
    )
    assert create_resp.status_code == 201
    category = create_resp.json()
    assert category["name"] == "Glass"

    list_resp = await client.get("/api/v1/item-categories", headers=auth_headers)
    assert list_resp.status_code == 200
    categories = list_resp.json()
    assert len(categories) == 1

    item_resp = await client.post(
        "/api/v1/items",
        json={"name": "Glass partition", "category_id": category["id"]},
        headers=auth_headers,
    )
    assert item_resp.status_code == 201
    assert item_resp.json()["category_id"] == category["id"]

    await client.post("/api/v1/items", json={"name": "Uncategorized item"}, headers=auth_headers)

    filtered_resp = await client.get(
        "/api/v1/items", params={"category_id": category["id"]}, headers=auth_headers
    )
    page = filtered_resp.json()
    assert page["total"] == 1
    assert page["items"][0]["name"] == "Glass partition"

    patch_resp = await client.patch(
        f"/api/v1/item-categories/{category['id']}", json={"name": "Glass & Aluminium"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Glass & Aluminium"

    delete_resp = await client.delete(f"/api/v1/item-categories/{category['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    list_after_delete = await client.get("/api/v1/item-categories", headers=auth_headers)
    assert list_after_delete.json() == []


async def test_item_categories_require_auth(client):
    resp = await client.get("/api/v1/item-categories")
    assert resp.status_code == 401
