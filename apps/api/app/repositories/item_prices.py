import uuid

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.price_list import ItemPrice
from app.schemas.price_list import ItemPriceInput


async def list_for_item(db: AsyncSession, tenant_id: uuid.UUID, item_id: uuid.UUID) -> list[ItemPrice]:
    query = select(ItemPrice).where(ItemPrice.tenant_id == tenant_id, ItemPrice.item_id == item_id)
    return list((await db.execute(query)).scalars().all())


async def set_for_item(
    db: AsyncSession, tenant_id: uuid.UUID, item_id: uuid.UUID, prices: list[ItemPriceInput]
) -> list[ItemPrice]:
    await db.execute(
        sa_delete(ItemPrice).where(ItemPrice.tenant_id == tenant_id, ItemPrice.item_id == item_id)
    )
    rows = [
        ItemPrice(tenant_id=tenant_id, item_id=item_id, price_list_id=p.price_list_id, price=p.price)
        for p in prices
    ]
    db.add_all(rows)
    await db.flush()
    return rows


async def list_for_price_list(db: AsyncSession, tenant_id: uuid.UUID, price_list_id: uuid.UUID) -> list[ItemPrice]:
    query = select(ItemPrice).where(ItemPrice.tenant_id == tenant_id, ItemPrice.price_list_id == price_list_id)
    return list((await db.execute(query)).scalars().all())
