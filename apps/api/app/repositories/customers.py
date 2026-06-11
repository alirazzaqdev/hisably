import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.party import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: CustomerCreate) -> Customer:
    customer = Customer(tenant_id=tenant_id, **payload.model_dump())
    db.add(customer)
    await db.flush()
    return customer


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Customer | None:
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_paginated(
    db: AsyncSession, tenant_id: uuid.UUID, *, search: str | None, page: int, page_size: int
) -> tuple[list[Customer], int]:
    query = select(Customer).where(Customer.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id)

    if search:
        pattern = f"%{search}%"
        condition = or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern), Customer.email.ilike(pattern))
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Customer.name).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return list(items), total


async def update(db: AsyncSession, customer: Customer, payload: CustomerUpdate) -> Customer:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    await db.flush()
    return customer


async def delete(db: AsyncSession, customer: Customer) -> None:
    await db.delete(customer)
    await db.flush()
