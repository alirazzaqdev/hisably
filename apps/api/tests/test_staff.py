async def test_owner_can_manage_staff(client, auth_headers):
    create_resp = await client.post(
        "/api/v1/users",
        json={"email": "staff@example.com", "password": "staffpass1", "permissions": {"reports": False, "items": True}},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    staff = create_resp.json()
    assert staff["role"] == "staff"
    assert staff["permissions"] == {"reports": False, "items": True}

    list_resp = await client.get("/api/v1/users", headers=auth_headers)
    assert list_resp.status_code == 200
    emails = [u["email"] for u in list_resp.json()]
    assert "staff@example.com" in emails
    assert "owner@example.com" in emails

    patch_resp = await client.patch(
        f"/api/v1/users/{staff['id']}", json={"permissions": {"reports": True, "items": True}}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["permissions"] == {"reports": True, "items": True}

    delete_resp = await client.delete(f"/api/v1/users/{staff['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204


async def test_staff_login_and_permission_enforcement(client, auth_headers, monkeypatch):
    from app.services import auth_service

    captured: dict[str, str] = {}

    def fake_send_otp_email(to_email: str, otp_code: str, purpose: str = "") -> None:
        captured[to_email] = otp_code

    monkeypatch.setattr(auth_service, "send_otp_email", fake_send_otp_email)

    await client.post(
        "/api/v1/users",
        json={"email": "staff2@example.com", "password": "staffpass1", "permissions": {"reports": False}},
        headers=auth_headers,
    )

    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "staff2@example.com", "password": "staffpass1"}
    )
    assert login_resp.status_code == 200
    staff_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    me_resp = await client.get("/api/v1/users/me", headers=staff_headers)
    assert me_resp.json()["role"] == "staff"

    forbidden_resp = await client.get("/api/v1/reports/vat-summary", headers=staff_headers)
    assert forbidden_resp.status_code == 403

    forbidden_settings = await client.patch(
        "/api/v1/tenants/me", json={"business_name": "Hacked LLC"}, headers=staff_headers
    )
    assert forbidden_settings.status_code == 403

    forbidden_create_staff = await client.post(
        "/api/v1/users", json={"email": "x@example.com", "password": "password1"}, headers=staff_headers
    )
    assert forbidden_create_staff.status_code == 403


async def test_users_require_auth(client):
    resp = await client.get("/api/v1/users")
    assert resp.status_code == 401
