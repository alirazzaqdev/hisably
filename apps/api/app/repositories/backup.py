import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, delete, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.expense import ExpenseEntry
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceNumberSequence
from app.models.item import Item
from app.models.item_category import ItemCategory
from app.models.party import Customer, Supplier
from app.models.payment import Payment, PaymentAllocation
from app.models.price_list import ItemPrice, PriceList
from app.models.recurring_invoice import RecurringInvoice
from app.models.stock import StockMovement

BACKUP_VERSION = 1

# Tenant-scoped tables, in an order that satisfies foreign-key dependencies on insert.
TENANT_TABLES = [
    Account,
    ItemCategory,
    PriceList,
    Item,
    ItemPrice,
    Customer,
    Supplier,
    InvoiceNumberSequence,
    Invoice,
    Payment,
    ExpenseEntry,
    RecurringInvoice,
    StockMovement,
]


def _serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    return value


def _deserialize_value(column: Any, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(column.type, JSON):
        return value
    py_type = column.type.python_type
    if py_type is uuid.UUID:
        return uuid.UUID(value)
    if py_type is Decimal:
        return Decimal(value)
    if py_type is datetime:
        return datetime.fromisoformat(value)
    if py_type is date:
        return date.fromisoformat(value)
    if isinstance(py_type, type) and issubclass(py_type, enum.Enum):
        return py_type(value)
    return value


def _serialize_row(model: type, row: Any) -> dict[str, Any]:
    columns = inspect(model).columns
    return {column.name: _serialize_value(getattr(row, column.name)) for column in columns}


def _deserialize_row(model: type, data: dict[str, Any]) -> dict[str, Any]:
    columns = inspect(model).columns
    return {column.name: _deserialize_value(column, data.get(column.name)) for column in columns}


async def export_data(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    data: dict[str, Any] = {"version": BACKUP_VERSION, "exported_at": datetime.now(timezone.utc).isoformat()}

    for model in TENANT_TABLES:
        rows = (await db.execute(select(model).where(model.tenant_id == tenant_id))).scalars().all()
        data[model.__tablename__] = [_serialize_row(model, row) for row in rows]

    line_items = (
        (
            await db.execute(
                select(InvoiceLineItem)
                .join(Invoice, Invoice.id == InvoiceLineItem.invoice_id)
                .where(Invoice.tenant_id == tenant_id)
            )
        )
        .scalars()
        .all()
    )
    data[InvoiceLineItem.__tablename__] = [_serialize_row(InvoiceLineItem, row) for row in line_items]

    allocations = (
        (
            await db.execute(
                select(PaymentAllocation)
                .join(Payment, Payment.id == PaymentAllocation.payment_id)
                .where(Payment.tenant_id == tenant_id)
            )
        )
        .scalars()
        .all()
    )
    data[PaymentAllocation.__tablename__] = [_serialize_row(PaymentAllocation, row) for row in allocations]

    return data


async def _wipe_tenant_data(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    await db.execute(
        delete(PaymentAllocation).where(
            PaymentAllocation.payment_id.in_(select(Payment.id).where(Payment.tenant_id == tenant_id))
        )
    )
    await db.execute(
        delete(InvoiceLineItem).where(
            InvoiceLineItem.invoice_id.in_(select(Invoice.id).where(Invoice.tenant_id == tenant_id))
        )
    )
    for model in reversed(TENANT_TABLES):
        await db.execute(delete(model).where(model.tenant_id == tenant_id))


async def import_data(db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]) -> None:
    await _wipe_tenant_data(db, tenant_id)
    await db.flush()

    deferred_invoice_links: list[tuple[uuid.UUID, uuid.UUID]] = []

    for model in TENANT_TABLES:
        rows = data.get(model.__tablename__, [])
        for raw in rows:
            values = _deserialize_row(model, raw)
            values["tenant_id"] = tenant_id
            if model is Invoice and values.get("converted_from_id") is not None:
                deferred_invoice_links.append((values["id"], values["converted_from_id"]))
                values["converted_from_id"] = None
            db.add(model(**values))
        await db.flush()

    for raw in data.get(InvoiceLineItem.__tablename__, []):
        values = _deserialize_row(InvoiceLineItem, raw)
        db.add(InvoiceLineItem(**values))
    await db.flush()

    for raw in data.get(PaymentAllocation.__tablename__, []):
        values = _deserialize_row(PaymentAllocation, raw)
        db.add(PaymentAllocation(**values))
    await db.flush()

    for invoice_id, converted_from_id in deferred_invoice_links:
        invoice = await db.get(Invoice, invoice_id)
        if invoice is not None:
            invoice.converted_from_id = converted_from_id
    await db.flush()
