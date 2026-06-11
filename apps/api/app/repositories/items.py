import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: ItemCreate) -> Item:
    item = Item(tenant_id=tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    return item


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, item_id: uuid.UUID) -> Item | None:
    result = await db.execute(select(Item).where(Item.id == item_id, Item.tenant_id == tenant_id))
    return result.scalar_one_or_none()


async def list_paginated(
    db: AsyncSession, tenant_id: uuid.UUID, *, search: str | None, page: int, page_size: int
) -> tuple[list[Item], int]:
    query = select(Item).where(Item.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(Item).where(Item.tenant_id == tenant_id)

    if search:
        pattern = f"%{search}%"
        condition = or_(Item.name.ilike(pattern), Item.sku.ilike(pattern))
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Item.name).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return list(items), total


async def update(db: AsyncSession, item: Item, payload: ItemUpdate) -> Item:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    return item


async def delete(db: AsyncSession, item: Item) -> None:
    await db.delete(item)
    await db.flush()
