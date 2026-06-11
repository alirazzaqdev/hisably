import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import InvoiceStatus, InvoiceType
from app.models.expense import ExpenseEntry
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.item import Item
from app.models.party import Customer, Supplier
from app.models.payment import Payment
from app.repositories.payments import get_paid_amount
from app.schemas.reports import DayBookEntry, StockSummaryItem

INVOICE_DAY_BOOK_DIRECTIONS = {
    InvoiceType.TAX_INVOICE: "in",
    InvoiceType.CREDIT_NOTE: "out",
    InvoiceType.DEBIT_NOTE: "in",
    InvoiceType.PURCHASE_BILL: "out",
}


async def count_customers(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    result = await db.execute(select(func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id))
    return result.scalar_one()


async def count_items(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    result = await db.execute(select(func.count()).select_from(Item).where(Item.tenant_id == tenant_id))
    return result.scalar_one()


async def count_invoices(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    result = await db.execute(select(func.count()).select_from(Invoice).where(Invoice.tenant_id == tenant_id))
    return result.scalar_one()


async def revenue_paid(db: AsyncSession, tenant_id: uuid.UUID) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(Invoice.grand_total), 0)).where(
            Invoice.tenant_id == tenant_id, Invoice.status == InvoiceStatus.PAID
        )
    )
    return result.scalar_one()


async def outstanding_receivables(db: AsyncSession, tenant_id: uuid.UUID) -> Decimal:
    query = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.customer_id.is_not(None),
        Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
    )
    invoices = list((await db.execute(query)).scalars().all())
    total = Decimal("0")
    for invoice in invoices:
        paid = await get_paid_amount(db, invoice.id)
        total += invoice.grand_total - paid
    return total


async def expenses_this_month(db: AsyncSession, tenant_id: uuid.UUID, today: date) -> Decimal:
    month_start = today.replace(day=1)
    result = await db.execute(
        select(func.coalesce(func.sum(ExpenseEntry.amount), 0)).where(
            ExpenseEntry.tenant_id == tenant_id, ExpenseEntry.expense_date >= month_start
        )
    )
    return result.scalar_one()


async def count_overdue_invoices(db: AsyncSession, tenant_id: uuid.UUID, today: date) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Invoice)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
            Invoice.due_date.is_not(None),
            Invoice.due_date < today,
        )
    )
    return result.scalar_one()


async def sales_trend(db: AsyncSession, tenant_id: uuid.UUID, months: int = 6) -> list[tuple[str, Decimal, Decimal]]:
    query = select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.status != InvoiceStatus.DRAFT)
    invoices = list((await db.execute(query)).scalars().all())

    totals: dict[str, list[Decimal]] = {}
    for invoice in invoices:
        period = invoice.issue_date.strftime("%Y-%m")
        bucket = totals.setdefault(period, [Decimal("0"), Decimal("0")])
        if invoice.status != InvoiceStatus.VOID:
            bucket[0] += invoice.grand_total
        if invoice.status == InvoiceStatus.PAID:
            bucket[1] += invoice.grand_total

    periods = sorted(totals.keys(), reverse=True)[:months]
    return [(p, totals[p][0], totals[p][1]) for p in reversed(periods)]


async def top_customers(db: AsyncSession, tenant_id: uuid.UUID, limit: int = 5) -> list[tuple[uuid.UUID, str, Decimal, Decimal]]:
    query = (
        select(
            Customer.id,
            Customer.name,
            func.coalesce(func.sum(Invoice.grand_total), 0).label("total_invoiced"),
            func.coalesce(func.sum(Invoice.grand_total).filter(Invoice.status == InvoiceStatus.PAID), 0).label(
                "total_paid"
            ),
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .where(Customer.tenant_id == tenant_id, Invoice.status != InvoiceStatus.VOID)
        .group_by(Customer.id, Customer.name)
        .order_by(func.coalesce(func.sum(Invoice.grand_total), 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [(row.id, row.name, row.total_invoiced, row.total_paid) for row in rows]


async def top_items(db: AsyncSession, tenant_id: uuid.UUID, limit: int = 5) -> list[tuple[uuid.UUID | None, str, Decimal, Decimal]]:
    query = (
        select(
            InvoiceLineItem.item_id,
            func.max(InvoiceLineItem.description).label("description"),
            func.coalesce(func.sum(InvoiceLineItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(InvoiceLineItem.line_total), 0).label("revenue"),
        )
        .join(Invoice, Invoice.id == InvoiceLineItem.invoice_id)
        .where(Invoice.tenant_id == tenant_id, Invoice.status != InvoiceStatus.VOID)
        .group_by(InvoiceLineItem.item_id, InvoiceLineItem.description)
        .order_by(func.coalesce(func.sum(InvoiceLineItem.line_total), 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [(row.item_id, row.description, row.quantity, row.revenue) for row in rows]


async def receivables_aging(db: AsyncSession, tenant_id: uuid.UUID, today: date) -> list[tuple[str, Decimal, int]]:
    query = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.customer_id.is_not(None),
        Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
    )
    invoices = list((await db.execute(query)).scalars().all())

    buckets = {
        "Current": [Decimal("0"), 0],
        "1-30 days": [Decimal("0"), 0],
        "31-60 days": [Decimal("0"), 0],
        "61-90 days": [Decimal("0"), 0],
        "90+ days": [Decimal("0"), 0],
    }

    for invoice in invoices:
        balance = invoice.grand_total - await get_paid_amount(db, invoice.id)
        if balance <= 0:
            continue
        if invoice.due_date is None or invoice.due_date >= today:
            label = "Current"
        else:
            days_overdue = (today - invoice.due_date).days
            if days_overdue <= 30:
                label = "1-30 days"
            elif days_overdue <= 60:
                label = "31-60 days"
            elif days_overdue <= 90:
                label = "61-90 days"
            else:
                label = "90+ days"
        buckets[label][0] += balance
        buckets[label][1] += 1

    return [(label, total, count) for label, (total, count) in buckets.items()]


async def vat_summary(
    db: AsyncSession, tenant_id: uuid.UUID, *, date_from: date | None, date_to: date | None
) -> tuple[Decimal, Decimal]:
    invoice_query = select(func.coalesce(func.sum(Invoice.vat_total), 0)).where(
        Invoice.tenant_id == tenant_id, Invoice.status != InvoiceStatus.DRAFT, Invoice.status != InvoiceStatus.VOID
    )
    expense_query = select(func.coalesce(func.sum(ExpenseEntry.vat_paid), 0)).where(
        ExpenseEntry.tenant_id == tenant_id
    )

    if date_from is not None:
        invoice_query = invoice_query.where(Invoice.issue_date >= date_from)
        expense_query = expense_query.where(ExpenseEntry.expense_date >= date_from)
    if date_to is not None:
        invoice_query = invoice_query.where(Invoice.issue_date <= date_to)
        expense_query = expense_query.where(ExpenseEntry.expense_date <= date_to)

    output_vat = (await db.execute(invoice_query)).scalar_one()
    input_vat = (await db.execute(expense_query)).scalar_one()
    return output_vat, input_vat


async def day_book(
    db: AsyncSession, tenant_id: uuid.UUID, *, date_from: date, date_to: date
) -> tuple[list[DayBookEntry], Decimal, Decimal]:
    entries: list[DayBookEntry] = []

    invoice_query = (
        select(Invoice, Customer.name, Supplier.name)
        .outerjoin(Customer, Invoice.customer_id == Customer.id)
        .outerjoin(Supplier, Invoice.supplier_id == Supplier.id)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.status != InvoiceStatus.DRAFT,
            Invoice.status != InvoiceStatus.VOID,
            Invoice.type.in_(list(INVOICE_DAY_BOOK_DIRECTIONS)),
            Invoice.issue_date >= date_from,
            Invoice.issue_date <= date_to,
        )
    )
    for invoice, customer_name, supplier_name in (await db.execute(invoice_query)).all():
        entries.append(
            DayBookEntry(
                id=invoice.id,
                entry_date=invoice.issue_date,
                type=invoice.type.value,
                reference=invoice.invoice_number or invoice.draft_number,
                party_name=customer_name or supplier_name,
                amount=invoice.grand_total,
                direction=INVOICE_DAY_BOOK_DIRECTIONS[invoice.type],
            )
        )

    payment_query = (
        select(Payment, Customer.name, Supplier.name)
        .outerjoin(Customer, Payment.customer_id == Customer.id)
        .outerjoin(Supplier, Payment.supplier_id == Supplier.id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.payment_date >= date_from,
            Payment.payment_date <= date_to,
        )
    )
    for payment, customer_name, supplier_name in (await db.execute(payment_query)).all():
        entries.append(
            DayBookEntry(
                id=payment.id,
                entry_date=payment.payment_date,
                type="payment",
                reference=payment.reference_no or "Payment",
                party_name=customer_name or supplier_name,
                amount=payment.amount,
                direction="in" if payment.customer_id is not None else "out",
            )
        )

    expense_query = (
        select(ExpenseEntry, Supplier.name)
        .outerjoin(Supplier, ExpenseEntry.supplier_id == Supplier.id)
        .where(
            ExpenseEntry.tenant_id == tenant_id,
            ExpenseEntry.expense_date >= date_from,
            ExpenseEntry.expense_date <= date_to,
        )
    )
    for expense, supplier_name in (await db.execute(expense_query)).all():
        entries.append(
            DayBookEntry(
                id=expense.id,
                entry_date=expense.expense_date,
                type="expense",
                reference=expense.category,
                party_name=supplier_name,
                amount=expense.amount,
                direction="out",
            )
        )

    entries.sort(key=lambda e: e.entry_date)

    total_in = sum((e.amount for e in entries if e.direction == "in"), Decimal("0"))
    total_out = sum((e.amount for e in entries if e.direction == "out"), Decimal("0"))
    return entries, total_in, total_out


async def stock_summary(db: AsyncSession, tenant_id: uuid.UUID) -> tuple[list[StockSummaryItem], Decimal]:
    items_query = (
        select(Item)
        .where(Item.tenant_id == tenant_id, Item.track_inventory.is_(True))
        .order_by(Item.name)
    )
    items = list((await db.execute(items_query)).scalars().all())

    summaries: list[StockSummaryItem] = []
    total_value = Decimal("0")

    for item in items:
        current_stock = item.current_stock or Decimal("0")
        stock_value = current_stock * item.purchase_price
        total_value += stock_value

        summaries.append(
            StockSummaryItem(
                item_id=item.id,
                name=item.name,
                sku=item.sku,
                unit=item.unit.value,
                current_stock=current_stock,
                purchase_price=item.purchase_price,
                stock_value=stock_value,
            )
        )

    return summaries, total_value
