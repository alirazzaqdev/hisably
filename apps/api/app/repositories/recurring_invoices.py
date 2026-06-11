import calendar
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import InvoiceType, RecurrenceFrequency
from app.models.recurring_invoice import RecurringInvoice
from app.models.tenant import Tenant
from app.repositories import invoices as invoices_repo
from app.schemas.invoice import InvoiceCreate, InvoiceLineItemInput
from app.schemas.recurring_invoice import RecurringInvoiceCreate, RecurringInvoiceUpdate


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def advance_date(d: date, frequency: RecurrenceFrequency) -> date:
    if frequency == RecurrenceFrequency.WEEKLY:
        return d + timedelta(days=7)
    if frequency == RecurrenceFrequency.MONTHLY:
        return _add_months(d, 1)
    if frequency == RecurrenceFrequency.QUARTERLY:
        return _add_months(d, 3)
    return _add_months(d, 12)


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: RecurringInvoiceCreate) -> RecurringInvoice:
    recurring = RecurringInvoice(
        tenant_id=tenant_id,
        customer_id=payload.customer_id,
        frequency=payload.frequency,
        start_date=payload.start_date,
        next_run_date=payload.start_date,
        end_date=payload.end_date,
        currency=payload.currency,
        discount_amount=payload.discount_amount,
        notes=payload.notes,
        terms=payload.terms,
        line_items=[item.model_dump(mode="json") for item in payload.line_items],
    )
    db.add(recurring)
    await db.flush()
    return recurring


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, recurring_id: uuid.UUID) -> RecurringInvoice | None:
    result = await db.execute(
        select(RecurringInvoice).where(RecurringInvoice.id == recurring_id, RecurringInvoice.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_paginated(
    db: AsyncSession, tenant_id: uuid.UUID, *, page: int, page_size: int
) -> tuple[list[RecurringInvoice], int]:
    count_query = select(func.count()).select_from(RecurringInvoice).where(RecurringInvoice.tenant_id == tenant_id)
    total = (await db.execute(count_query)).scalar_one()

    query = (
        select(RecurringInvoice)
        .where(RecurringInvoice.tenant_id == tenant_id)
        .order_by(RecurringInvoice.next_run_date)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(query)).scalars().all()
    return list(items), total


async def update(db: AsyncSession, recurring: RecurringInvoice, payload: RecurringInvoiceUpdate) -> RecurringInvoice:
    data = payload.model_dump(exclude_unset=True)
    if "line_items" in data and data["line_items"] is not None:
        data["line_items"] = [item.model_dump(mode="json") for item in payload.line_items]
    for field, value in data.items():
        setattr(recurring, field, value)
    await db.flush()
    return recurring


async def delete(db: AsyncSession, recurring: RecurringInvoice) -> None:
    await db.delete(recurring)
    await db.flush()


async def generate_invoice(db: AsyncSession, tenant: Tenant, recurring: RecurringInvoice):
    line_items = [
        InvoiceLineItemInput(
            item_id=item.get("item_id"),
            description=item["description"],
            quantity=Decimal(str(item.get("quantity", "1"))),
            unit_price=Decimal(str(item.get("unit_price", "0"))),
            vat_category=item.get("vat_category", "standard"),
        )
        for item in recurring.line_items
    ]
    payload = InvoiceCreate(
        type=InvoiceType.TAX_INVOICE,
        customer_id=recurring.customer_id,
        issue_date=recurring.next_run_date,
        currency=recurring.currency,
        discount_amount=recurring.discount_amount,
        notes=recurring.notes,
        terms=recurring.terms,
        line_items=line_items,
    )
    invoice = await invoices_repo.create(db, tenant, payload)
    recurring.last_generated_invoice_id = invoice.id
    recurring.next_run_date = advance_date(recurring.next_run_date, recurring.frequency)
    await db.flush()
    return invoice


async def list_due(db: AsyncSession, tenant_id: uuid.UUID, *, today: date) -> list[RecurringInvoice]:
    query = select(RecurringInvoice).where(
        RecurringInvoice.tenant_id == tenant_id,
        RecurringInvoice.is_active.is_(True),
        RecurringInvoice.next_run_date <= today,
        (RecurringInvoice.end_date.is_(None)) | (RecurringInvoice.end_date >= RecurringInvoice.next_run_date),
    )
    return list((await db.execute(query)).scalars().all())
