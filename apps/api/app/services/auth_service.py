import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_otp_email
from app.core.security import (
    create_access_token,
    generate_otp_code,
    generate_refresh_token,
    hash_otp,
    hash_password,
    verify_otp as verify_otp_code,
    verify_password,
)
from app.core.time import utcnow
from app.models.enums import Country, UserRole
from app.models.user import User
from app.repositories import firm_memberships as firm_memberships_repo
from app.repositories import item_categories as item_categories_repo
from app.repositories import refresh_tokens as refresh_tokens_repo
from app.repositories import tenants as tenants_repo
from app.repositories import users as users_repo

OTP_VALIDITY_MINUTES = 10


class AuthError(Exception):
    """Raised for auth flow failures that map directly to HTTP error responses."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str


def _issue_otp(user: User) -> str:
    code = generate_otp_code()
    user.otp_code_hash = hash_otp(code)
    user.otp_expires_at = utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES)
    return code


async def issue_token_pair(db: AsyncSession, user: User, tenant_id: uuid.UUID | None = None) -> TokenPair:
    active_tenant_id = tenant_id or user.tenant_id
    access_token = create_access_token(str(user.id), {"tenant_id": str(active_tenant_id)})
    refresh_token = generate_refresh_token()
    await refresh_tokens_repo.create(db, user.id, refresh_token)
    await db.commit()
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


async def signup(db: AsyncSession, email: str, password: str) -> User:
    existing = await users_repo.get_by_email(db, email)
    if existing is not None:
        raise AuthError(409, "An account with this email already exists.")

    # Every user belongs to a tenant; signup creates a placeholder tenant that
    # the onboarding flow then fills in with real business details.
    tenant = await tenants_repo.create(db, business_name="My Business", country=Country.AE)

    user = User(
        tenant_id=tenant.id,
        email=email,
        password_hash=hash_password(password),
        role=UserRole.OWNER,
    )
    otp_code = _issue_otp(user)
    db.add(user)
    await db.flush()

    await firm_memberships_repo.create(db, user.id, tenant.id)
    await item_categories_repo.seed_defaults(db, tenant.id)
    await db.commit()

    send_otp_email(user.email, otp_code, purpose="verify your account")
    return user


async def verify_otp(db: AsyncSession, email: str, otp_code: str) -> User:
    user = await users_repo.get_by_email(db, email)
    if user is None:
        raise AuthError(404, "No account found for this email.")
    if user.email_verified_at is not None:
        raise AuthError(400, "This account is already verified.")
    if user.otp_code_hash is None or user.otp_expires_at is None:
        raise AuthError(400, "No verification code was requested.")
    if user.otp_expires_at < utcnow():
        raise AuthError(400, "Verification code has expired. Please request a new one.")
    if not verify_otp_code(otp_code, user.otp_code_hash):
        raise AuthError(400, "Invalid verification code.")

    user.email_verified_at = utcnow()
    user.otp_code_hash = None
    user.otp_expires_at = None
    await db.commit()
    return user


async def resend_otp(db: AsyncSession, email: str) -> None:
    user = await users_repo.get_by_email(db, email)
    if user is None:
        raise AuthError(404, "No account found for this email.")
    if user.email_verified_at is not None:
        raise AuthError(400, "This account is already verified.")

    otp_code = _issue_otp(user)
    await db.commit()
    send_otp_email(user.email, otp_code, purpose="verify your account")


async def login(db: AsyncSession, email: str, password: str) -> TokenPair:
    user = await users_repo.get_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError(401, "Invalid email or password.")
    if user.email_verified_at is None:
        raise AuthError(403, "Please verify your email before logging in.")

    return await issue_token_pair(db, user)


async def refresh(db: AsyncSession, refresh_token: str) -> TokenPair:
    stored = await refresh_tokens_repo.get_valid(db, refresh_token)
    if stored is None:
        raise AuthError(401, "Invalid or expired refresh token.")

    user = await users_repo.get_by_id(db, stored.user_id)
    if user is None:
        raise AuthError(401, "User not found.")

    await refresh_tokens_repo.revoke(db, stored)
    return await issue_token_pair(db, user)


async def logout(db: AsyncSession, refresh_token: str) -> None:
    stored = await refresh_tokens_repo.get_valid(db, refresh_token)
    if stored is not None:
        await refresh_tokens_repo.revoke(db, stored)
        await db.commit()


async def forgot_password(db: AsyncSession, email: str) -> None:
    user = await users_repo.get_by_email(db, email)
    if user is None:
        # Don't reveal whether an account exists for this email.
        return

    otp_code = _issue_otp(user)
    await db.commit()
    send_otp_email(user.email, otp_code, purpose="reset your password")


async def reset_password(db: AsyncSession, email: str, otp_code: str, new_password: str) -> None:
    user = await users_repo.get_by_email(db, email)
    if user is None:
        raise AuthError(404, "No account found for this email.")
    if user.otp_code_hash is None or user.otp_expires_at is None:
        raise AuthError(400, "No password reset was requested.")
    if user.otp_expires_at < utcnow():
        raise AuthError(400, "Verification code has expired. Please request a new one.")
    if not verify_otp_code(otp_code, user.otp_code_hash):
        raise AuthError(400, "Invalid verification code.")

    user.password_hash = hash_password(new_password)
    user.otp_code_hash = None
    user.otp_expires_at = None
    await db.commit()
