import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.price_list import PriceList
from app.schemas.price_list import PriceListCreate, PriceListUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: PriceListCreate) -> PriceList:
    price_list = PriceList(tenant_id=tenant_id, **payload.model_dump())
    db.add(price_list)
    await db.flush()
    return price_list


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, price_list_id: uuid.UUID) -> PriceList | None:
    result = await db.execute(
        select(PriceList).where(PriceList.id == price_list_id, PriceList.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, tenant_id: uuid.UUID) -> list[PriceList]:
    query = select(PriceList).where(PriceList.tenant_id == tenant_id).order_by(PriceList.name)
    return list((await db.execute(query)).scalars().all())


async def update(db: AsyncSession, price_list: PriceList, payload: PriceListUpdate) -> PriceList:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(price_list, field, value)
    await db.flush()
    return price_list


async def delete(db: AsyncSession, price_list: PriceList) -> None:
    await db.delete(price_list)
    await db.flush()
