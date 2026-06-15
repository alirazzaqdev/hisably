import pytest

from app.services import auth_service


@pytest.fixture
def captured_otps(monkeypatch):
    captured: dict[str, str] = {}

    def fake_send_otp_email(to_email: str, otp_code: str, purpose: str = "") -> None:
        captured[to_email] = otp_code

    monkeypatch.setattr(auth_service, "send_otp_email", fake_send_otp_email)
    return captured


async def test_signup_verify_login_refresh_logout(client, captured_otps):
    signup_resp = await client.post(
        "/api/v1/auth/signup", json={"email": "owner@example.com", "password": "supersecret"}
    )
    assert signup_resp.status_code == 201
    body = signup_resp.json()
    assert body["email"] == "owner@example.com"
    assert body["email_verified"] is False

    # Signing up again with the same email is rejected.
    duplicate_resp = await client.post(
        "/api/v1/auth/signup", json={"email": "owner@example.com", "password": "supersecret"}
    )
    assert duplicate_resp.status_code == 409

    # Logging in before verification is rejected.
    early_login = await client.post(
        "/api/v1/auth/login", json={"email": "owner@example.com", "password": "supersecret"}
    )
    assert early_login.status_code == 403

    otp_code = captured_otps["owner@example.com"]

    # Wrong OTP is rejected.
    bad_otp = await client.post(
        "/api/v1/auth/verify-otp", json={"email": "owner@example.com", "otp_code": "000000"}
    )
    assert bad_otp.status_code == 400

    verify_resp = await client.post(
        "/api/v1/auth/verify-otp", json={"email": "owner@example.com", "otp_code": otp_code}
    )
    assert verify_resp.status_code == 200
    tokens = verify_resp.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    # Verifying again is rejected.
    reverify_resp = await client.post(
        "/api/v1/auth/verify-otp", json={"email": "owner@example.com", "otp_code": otp_code}
    )
    assert reverify_resp.status_code == 400

    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "owner@example.com", "password": "supersecret"}
    )
    assert login_resp.status_code == 200
    login_tokens = login_resp.json()

    refresh_resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login_tokens["refresh_token"]}
    )
    assert refresh_resp.status_code == 200
    refreshed_tokens = refresh_resp.json()
    assert refreshed_tokens["access_token"]

    # The old refresh token has been rotated and can no longer be used.
    reuse_resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login_tokens["refresh_token"]}
    )
    assert reuse_resp.status_code == 401

    logout_resp = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": refreshed_tokens["refresh_token"]}
    )
    assert logout_resp.status_code == 200

    after_logout_refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refreshed_tokens["refresh_token"]}
    )
    assert after_logout_refresh.status_code == 401


async def test_resend_otp(client, captured_otps):
    await client.post("/api/v1/auth/signup", json={"email": "resend@example.com", "password": "supersecret"})
    first_otp = captured_otps["resend@example.com"]

    resend_resp = await client.post("/api/v1/auth/resend-otp", json={"email": "resend@example.com"})
    assert resend_resp.status_code == 200

    second_otp = captured_otps["resend@example.com"]
    assert first_otp != second_otp

    verify_resp = await client.post(
        "/api/v1/auth/verify-otp", json={"email": "resend@example.com", "otp_code": second_otp}
    )
    assert verify_resp.status_code == 200


async def test_forgot_and_reset_password(client, captured_otps):
    await client.post("/api/v1/auth/signup", json={"email": "reset@example.com", "password": "oldpassword"})
    otp_code = captured_otps["reset@example.com"]
    await client.post("/api/v1/auth/verify-otp", json={"email": "reset@example.com", "otp_code": otp_code})

    forgot_resp = await client.post("/api/v1/auth/forgot-password", json={"email": "reset@example.com"})
    assert forgot_resp.status_code == 200

    # Forgot-password for an unknown email also returns 200, without leaking existence.
    unknown_resp = await client.post("/api/v1/auth/forgot-password", json={"email": "unknown@example.com"})
    assert unknown_resp.status_code == 200

    reset_otp = captured_otps["reset@example.com"]
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "reset@example.com", "otp_code": reset_otp, "new_password": "newpassword"},
    )
    assert reset_resp.status_code == 200

    old_login = await client.post(
        "/api/v1/auth/login", json={"email": "reset@example.com", "password": "oldpassword"}
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        "/api/v1/auth/login", json={"email": "reset@example.com", "password": "newpassword"}
    )
    assert new_login.status_code == 200


async def test_onboarding_business(client, captured_otps):
    await client.post("/api/v1/auth/signup", json={"email": "onboard@example.com", "password": "supersecret"})
    otp_code = captured_otps["onboard@example.com"]
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp", json={"email": "onboard@example.com", "otp_code": otp_code}
    )
    access_token = verify_resp.json()["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}

    unauthenticated_resp = await client.post(
        "/api/v1/onboarding/business", json={"business_name": "Acme Trading"}
    )
    assert unauthenticated_resp.status_code == 401

    onboarding_resp = await client.post(
        "/api/v1/onboarding/business",
        headers=headers,
        json={
            "business_name": "Acme Trading",
            "country": "AE",
            "trn": "100123456700003",
            "vat_registered": True,
            "invoice_prefix": "ACM-",
            "invoice_starting_number": 1001,
        },
    )
    assert onboarding_resp.status_code == 200
    body = onboarding_resp.json()
    assert body["business_name"] == "Acme Trading"
    assert body["currency"] == "AED"
    assert body["vat_registered"] is True
    assert body["invoice_prefix"] == "ACM-"

    accounts_resp = await client.get("/api/v1/accounts", headers=headers)
    assert accounts_resp.status_code == 200
    accounts = accounts_resp.json()
    assert {a["name"] for a in accounts} == {"Cash", "Bank"}
    assert {a["type"] for a in accounts} == {"cash", "bank"}
