import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app

FIXTURES_PATH = (
    Path(__file__).resolve().parents[3] / "packages" / "shared" / "test-fixtures" / "line-item-cases.json"
)


@pytest.fixture(scope="session")
def line_item_fixtures() -> dict:
    return json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_local() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client, monkeypatch) -> dict[str, str]:
    """Signs up, verifies, and logs in a fresh user; returns Bearer auth headers."""
    from app.services import auth_service

    captured: dict[str, str] = {}

    def fake_send_otp_email(to_email: str, otp_code: str, purpose: str = "") -> None:
        captured[to_email] = otp_code

    monkeypatch.setattr(auth_service, "send_otp_email", fake_send_otp_email)

    email = "owner@example.com"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": "supersecret"})
    otp_code = captured[email]
    verify_resp = await client.post("/api/v1/auth/verify-otp", json={"email": email, "otp_code": otp_code})
    access_token = verify_resp.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}
