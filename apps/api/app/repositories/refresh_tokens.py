import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_refresh_token
from app.core.time import utcnow
from app.models.auth import RefreshToken


async def create(db: AsyncSession, user_id: uuid.UUID, token: str) -> RefreshToken:
    settings = get_settings()
    refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(token),
        expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_token)
    await db.flush()
    return refresh_token


async def get_valid(db: AsyncSession, token: str) -> RefreshToken | None:
    token_hash = hash_refresh_token(token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    refresh_token = result.scalar_one_or_none()

    if refresh_token is None or refresh_token.revoked_at is not None:
        return None
    if refresh_token.expires_at < utcnow():
        return None
    return refresh_token


async def revoke(db: AsyncSession, refresh_token: RefreshToken) -> None:
    refresh_token.revoked_at = utcnow()
    await db.flush()
