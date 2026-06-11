import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_category import ItemCategory
from app.schemas.item_category import ItemCategoryCreate, ItemCategoryUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: ItemCategoryCreate) -> ItemCategory:
    category = ItemCategory(tenant_id=tenant_id, **payload.model_dump())
    db.add(category)
    await db.flush()
    return category


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, category_id: uuid.UUID) -> ItemCategory | None:
    result = await db.execute(
        select(ItemCategory).where(ItemCategory.id == category_id, ItemCategory.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, tenant_id: uuid.UUID) -> list[ItemCategory]:
    query = select(ItemCategory).where(ItemCategory.tenant_id == tenant_id).order_by(ItemCategory.name)
    return list((await db.execute(query)).scalars().all())


async def update(db: AsyncSession, category: ItemCategory, payload: ItemCategoryUpdate) -> ItemCategory:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.flush()
    return category


async def delete(db: AsyncSession, category: ItemCategory) -> None:
    await db.delete(category)
    await db.flush()
