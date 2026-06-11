import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.firm_membership import FirmMembership


async def create(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> FirmMembership:
    membership = FirmMembership(user_id=user_id, tenant_id=tenant_id)
    db.add(membership)
    await db.flush()
    return membership


async def exists(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(FirmMembership.id).where(
            FirmMembership.user_id == user_id, FirmMembership.tenant_id == tenant_id
        )
    )
    return result.scalar_one_or_none() is not None


async def list_tenant_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(select(FirmMembership.tenant_id).where(FirmMembership.user_id == user_id))
    return list(result.scalars().all())
