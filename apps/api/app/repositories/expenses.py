import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import ExpenseEntry
from app.schemas.expense import ExpenseCreate, ExpenseUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: ExpenseCreate) -> ExpenseEntry:
    expense = ExpenseEntry(
        tenant_id=tenant_id,
        client_uuid=payload.client_uuid or uuid.uuid4(),
        **payload.model_dump(exclude={"client_uuid"}),
    )
    db.add(expense)
    await db.flush()
    return expense


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, expense_id: uuid.UUID) -> ExpenseEntry | None:
    result = await db.execute(
        select(ExpenseEntry).where(ExpenseEntry.id == expense_id, ExpenseEntry.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_paginated(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    category: str | None,
    search: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> tuple[list[ExpenseEntry], int]:
    query = select(ExpenseEntry).where(ExpenseEntry.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(ExpenseEntry).where(ExpenseEntry.tenant_id == tenant_id)

    if category:
        query = query.where(ExpenseEntry.category == category)
        count_query = count_query.where(ExpenseEntry.category == category)

    if search:
        pattern = f"%{search}%"
        clause = or_(ExpenseEntry.category.ilike(pattern), ExpenseEntry.notes.ilike(pattern))
        query = query.where(clause)
        count_query = count_query.where(clause)

    if date_from:
        query = query.where(ExpenseEntry.expense_date >= date_from)
        count_query = count_query.where(ExpenseEntry.expense_date >= date_from)

    if date_to:
        query = query.where(ExpenseEntry.expense_date <= date_to)
        count_query = count_query.where(ExpenseEntry.expense_date <= date_to)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(ExpenseEntry.expense_date.desc(), ExpenseEntry.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    items = list((await db.execute(query)).scalars().all())
    return items, total


async def update(db: AsyncSession, expense: ExpenseEntry, payload: ExpenseUpdate) -> ExpenseEntry:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    await db.flush()
    return expense


async def delete(db: AsyncSession, expense: ExpenseEntry) -> None:
    await db.delete(expense)
    await db.flush()
