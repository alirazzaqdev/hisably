async def test_get_current_user_and_tenant(client, auth_headers):
    user_resp = await client.get("/api/v1/users/me", headers=auth_headers)
    assert user_resp.status_code == 200
    user = user_resp.json()
    assert user["email"] == "owner@example.com"
    assert user["role"] == "owner"
    assert user["email_verified"] is True

    tenant_resp = await client.get("/api/v1/tenants/me", headers=auth_headers)
    assert tenant_resp.status_code == 200
    tenant = tenant_resp.json()
    assert tenant["business_name"]
    assert tenant["country"] == "AE"
