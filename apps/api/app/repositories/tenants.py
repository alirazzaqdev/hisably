import uuid

from app.models.enums import Country
from app.models.tenant import Tenant
from sqlalchemy.ext.asyncio import AsyncSession


async def create(db: AsyncSession, business_name: str, country: Country) -> Tenant:
    tenant = Tenant(business_name=business_name, country=country)
    db.add(tenant)
    await db.flush()
    return tenant


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    return await db.get(Tenant, tenant_id)
