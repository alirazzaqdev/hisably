async def test_price_list_crud_and_item_prices(client, auth_headers):
    create_resp = await client.post("/api/v1/price-lists", json={"name": "Wholesale"}, headers=auth_headers)
    assert create_resp.status_code == 201
    price_list = create_resp.json()
    assert price_list["name"] == "Wholesale"

    list_resp = await client.get("/api/v1/price-lists", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    item_resp = await client.post(
        "/api/v1/items",
        json={"name": "Glass partition", "sale_price": "150.00"},
        headers=auth_headers,
    )
    item_id = item_resp.json()["id"]

    set_resp = await client.put(
        f"/api/v1/items/{item_id}/prices",
        json=[{"price_list_id": price_list["id"], "price": "120.00"}],
        headers=auth_headers,
    )
    assert set_resp.status_code == 200
    assert set_resp.json()[0]["price"] == "120.00"

    get_resp = await client.get(f"/api/v1/items/{item_id}/prices", headers=auth_headers)
    assert get_resp.status_code == 200
    prices = get_resp.json()
    assert len(prices) == 1
    assert prices[0]["price_list_id"] == price_list["id"]
    assert prices[0]["price"] == "120.00"

    pl_items_resp = await client.get(f"/api/v1/price-lists/{price_list['id']}/prices", headers=auth_headers)
    assert pl_items_resp.status_code == 200
    pl_items = pl_items_resp.json()
    assert len(pl_items) == 1
    assert pl_items[0]["item_id"] == item_id
    assert pl_items[0]["price"] == "120.00"

    customer_resp = await client.post(
        "/api/v1/customers",
        json={"name": "Wholesale Customer", "price_list_id": price_list["id"]},
        headers=auth_headers,
    )
    assert customer_resp.status_code == 201
    assert customer_resp.json()["price_list_id"] == price_list["id"]

    patch_resp = await client.patch(
        f"/api/v1/price-lists/{price_list['id']}", json={"name": "Wholesale (bulk)"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Wholesale (bulk)"

    delete_resp = await client.delete(f"/api/v1/price-lists/{price_list['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    list_after_delete = await client.get("/api/v1/price-lists", headers=auth_headers)
    assert list_after_delete.json() == []


async def test_price_lists_require_auth(client):
    resp = await client.get("/api/v1/price-lists")
    assert resp.status_code == 401
