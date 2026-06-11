import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.party import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: SupplierCreate) -> Supplier:
    supplier = Supplier(tenant_id=tenant_id, **payload.model_dump())
    db.add(supplier)
    await db.flush()
    return supplier


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, supplier_id: uuid.UUID) -> Supplier | None:
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_paginated(
    db: AsyncSession, tenant_id: uuid.UUID, *, search: str | None, page: int, page_size: int
) -> tuple[list[Supplier], int]:
    query = select(Supplier).where(Supplier.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(Supplier).where(Supplier.tenant_id == tenant_id)

    if search:
        pattern = f"%{search}%"
        condition = or_(Supplier.name.ilike(pattern), Supplier.phone.ilike(pattern), Supplier.email.ilike(pattern))
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Supplier.name).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return list(items), total


async def update(db: AsyncSession, supplier: Supplier, payload: SupplierUpdate) -> Supplier:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    await db.flush()
    return supplier


async def delete(db: AsyncSession, supplier: Supplier) -> None:
    await db.delete(supplier)
    await db.flush()
