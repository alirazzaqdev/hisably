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


async def test_update_tenant_settings(client, auth_headers):
    patch_resp = await client.patch(
        "/api/v1/tenants/me",
        json={
            "business_name": "Hisably Demo LLC",
            "trn": "100123456700003",
            "vat_registered": True,
            "address": "Sheikh Zayed Road, Dubai",
            "invoice_prefix": "HSB-",
            "default_vat_category": "standard",
        },
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    tenant = patch_resp.json()
    assert tenant["business_name"] == "Hisably Demo LLC"
    assert tenant["trn"] == "100123456700003"
    assert tenant["vat_registered"] is True
    assert tenant["address"] == "Sheikh Zayed Road, Dubai"
    assert tenant["invoice_prefix"] == "HSB-"
    assert tenant["default_vat_category"] == "standard"

    get_resp = await client.get("/api/v1/tenants/me", headers=auth_headers)
    assert get_resp.json()["business_name"] == "Hisably Demo LLC"
