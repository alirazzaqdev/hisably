import uuid
from datetime import datetime

from sqlalchemy import DateTime, cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import ExpenseEntry
from app.models.invoice import Invoice
from app.models.item import Item
from app.models.party import Customer
from app.models.payment import Payment
from app.models.sync import SyncLogEntry
from app.repositories.invoices import get_line_items
from app.repositories.payments import get_allocations


async def get_log_entry(
    db: AsyncSession, tenant_id: uuid.UUID, client_uuid: uuid.UUID, entity_type: str
) -> SyncLogEntry | None:
    result = await db.execute(
        select(SyncLogEntry).where(
            SyncLogEntry.tenant_id == tenant_id,
            SyncLogEntry.client_uuid == client_uuid,
            SyncLogEntry.entity_type == entity_type,
        )
    )
    return result.scalar_one_or_none()


async def record_log_entry(
    db: AsyncSession, tenant_id: uuid.UUID, client_uuid: uuid.UUID, entity_type: str, result_entity_id: uuid.UUID
) -> SyncLogEntry:
    entry = SyncLogEntry(
        tenant_id=tenant_id,
        client_uuid=client_uuid,
        entity_type=entity_type,
        result_entity_id=result_entity_id,
    )
    db.add(entry)
    await db.flush()
    return entry


async def _changed(db: AsyncSession, model, tenant_id: uuid.UUID, since: datetime | None) -> list:
    query = select(model).where(model.tenant_id == tenant_id)
    if since is not None:
        query = query.where(model.updated_at >= cast(since, DateTime()))
    query = query.order_by(model.updated_at.asc())
    return list((await db.execute(query)).scalars().all())


async def pull_changes(
    db: AsyncSession, tenant_id: uuid.UUID, since: datetime | None
) -> tuple[list[Customer], list[Item], list[ExpenseEntry], list[Invoice], list[Payment]]:
    customers = await _changed(db, Customer, tenant_id, since)
    items = await _changed(db, Item, tenant_id, since)
    expenses = await _changed(db, ExpenseEntry, tenant_id, since)
    invoices = await _changed(db, Invoice, tenant_id, since)
    payments = await _changed(db, Payment, tenant_id, since)

    for invoice in invoices:
        invoice.line_items_loaded = await get_line_items(db, invoice.id)
    for payment in payments:
        payment.allocations_loaded = await get_allocations(db, payment.id)

    return customers, items, expenses, invoices, payments
