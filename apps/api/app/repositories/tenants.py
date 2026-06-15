import uuid
from decimal import Decimal

from app.models.enums import Country
from app.models.tenant import Tenant
from app.schemas.tenant import TenantUpdate
from app.tax.countries import get_country_info
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def create(db: AsyncSession, business_name: str, country: Country) -> Tenant:
    country_info = get_country_info(country.value)
    tenant = Tenant(
        business_name=business_name,
        country=country,
        currency=country_info.currency if country_info else "AED",
        vat_rate=Decimal(str(country_info.vat_rate)) if country_info else Decimal("5"),
    )
    db.add(tenant)
    await db.flush()
    return tenant


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    return await db.get(Tenant, tenant_id)


async def get_many_by_ids(db: AsyncSession, tenant_ids: list[uuid.UUID]) -> list[Tenant]:
    if not tenant_ids:
        return []
    result = await db.execute(select(Tenant).where(Tenant.id.in_(tenant_ids)))
    return list(result.scalars().all())


async def update(db: AsyncSession, tenant: Tenant, payload: TenantUpdate) -> Tenant:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)
    await db.flush()
    return tenant
