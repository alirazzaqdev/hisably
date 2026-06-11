import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import StaffCreate, StaffUpdate


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def get_by_id_in_tenant(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    return result.scalar_one_or_none()


async def list_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(select(User).where(User.tenant_id == tenant_id).order_by(User.created_at))
    return list(result.scalars().all())


async def create_staff(db: AsyncSession, tenant_id: uuid.UUID, payload: StaffCreate) -> User:
    user = User(
        tenant_id=tenant_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.STAFF,
        permissions=payload.permissions,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    return user


async def update_permissions(db: AsyncSession, user: User, payload: StaffUpdate) -> User:
    if payload.permissions is not None:
        user.permissions = payload.permissions
    await db.flush()
    return user


async def delete(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
