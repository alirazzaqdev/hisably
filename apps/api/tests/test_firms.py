async def test_owner_can_create_list_and_switch_firms(client, auth_headers):
    list_resp = await client.get("/api/v1/firms", headers=auth_headers)
    assert list_resp.status_code == 200
    firms = list_resp.json()
    assert len(firms) == 1
    assert firms[0]["is_active"] is True
    home_firm_id = firms[0]["id"]

    create_resp = await client.post(
        "/api/v1/firms", json={"business_name": "Second Shop", "country": "AE"}, headers=auth_headers
    )
    assert create_resp.status_code == 201
    second_firm = create_resp.json()
    assert second_firm["business_name"] == "Second Shop"
    assert second_firm["is_active"] is False

    list_resp = await client.get("/api/v1/firms", headers=auth_headers)
    firms = list_resp.json()
    assert len(firms) == 2
    assert {f["id"] for f in firms} == {home_firm_id, second_firm["id"]}

    # Create a customer in the home firm.
    await client.post("/api/v1/customers", json={"name": "Home Firm Customer"}, headers=auth_headers)
    customers_resp = await client.get("/api/v1/customers", headers=auth_headers)
    assert customers_resp.json()["total"] == 1

    # Switch into the second firm.
    switch_resp = await client.post(f"/api/v1/firms/{second_firm['id']}/switch", headers=auth_headers)
    assert switch_resp.status_code == 200
    second_firm_token = switch_resp.json()["access_token"]
    second_headers = {"Authorization": f"Bearer {second_firm_token}"}

    # The second firm's data is isolated from the home firm.
    customers_resp = await client.get("/api/v1/customers", headers=second_headers)
    assert customers_resp.json()["total"] == 0

    me_resp = await client.get("/api/v1/tenants/me", headers=second_headers)
    assert me_resp.json()["business_name"] == "Second Shop"

    firms_resp = await client.get("/api/v1/firms", headers=second_headers)
    firms = firms_resp.json()
    active = next(f for f in firms if f["is_active"])
    assert active["id"] == second_firm["id"]


async def test_cannot_switch_to_another_owners_firm(client, auth_headers, monkeypatch):
    from app.services import auth_service

    captured: dict[str, str] = {}

    def fake_send_otp_email(to_email: str, otp_code: str, purpose: str = "") -> None:
        captured[to_email] = otp_code

    monkeypatch.setattr(auth_service, "send_otp_email", fake_send_otp_email)

    other_email = "other-owner@example.com"
    await client.post("/api/v1/auth/signup", json={"email": other_email, "password": "supersecret"})
    otp_code = captured[other_email]
    verify_resp = await client.post("/api/v1/auth/verify-otp", json={"email": other_email, "otp_code": otp_code})
    other_token = verify_resp.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    other_firms_resp = await client.get("/api/v1/firms", headers=other_headers)
    other_firm_id = other_firms_resp.json()[0]["id"]

    switch_resp = await client.post(f"/api/v1/firms/{other_firm_id}/switch", headers=auth_headers)
    assert switch_resp.status_code == 403


async def test_staff_cannot_access_firms(client, auth_headers, monkeypatch):
    from app.services import auth_service

    captured: dict[str, str] = {}

    def fake_send_otp_email(to_email: str, otp_code: str, purpose: str = "") -> None:
        captured[to_email] = otp_code

    monkeypatch.setattr(auth_service, "send_otp_email", fake_send_otp_email)

    create_resp = await client.post(
        "/api/v1/users",
        json={"email": "staff@example.com", "password": "staffpass1", "permissions": {}},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201

    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "staff@example.com", "password": "staffpass1"}
    )
    staff_token = login_resp.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    list_resp = await client.get("/api/v1/firms", headers=staff_headers)
    assert list_resp.status_code == 403
