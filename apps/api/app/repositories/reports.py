import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ChequeStatus, InvoiceStatus, InvoiceType
from app.models.expense import ExpenseEntry
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.item import Item
from app.models.party import Customer, Supplier
from app.models.payment import Payment, PaymentAllocation
from app.repositories.payments import get_paid_amount
from app.schemas.reports import DayBookEntry, ExpenseCategoryTotal, StockSummaryItem

INVOICE_DAY_BOOK_DIRECTIONS = {
    InvoiceType.TAX_INVOICE: "in",
    InvoiceType.CREDIT_NOTE: "out",
    InvoiceType.DEBIT_NOTE: "in",
    InvoiceType.PURCHASE_BILL: "out",
}


def _q2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


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
    # Fix 1: Sales = TAX_INVOICE paid; Returns = CREDIT_NOTE paid; Result = sales - returns
    # PURCHASE_BILL and DEBIT_NOTE must NOT count
    sales_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.grand_total * Invoice.exchange_rate), 0)).where(
            Invoice.tenant_id == tenant_id,
            Invoice.type == InvoiceType.TAX_INVOICE,
            Invoice.status == InvoiceStatus.PAID,
        )
    )
    returns_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.grand_total * Invoice.exchange_rate), 0)).where(
            Invoice.tenant_id == tenant_id,
            Invoice.type == InvoiceType.CREDIT_NOTE,
            Invoice.status == InvoiceStatus.PAID,
        )
    )
    sales = sales_result.scalar_one()
    returns = returns_result.scalar_one()
    return _q2(sales - returns)


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
        total += (invoice.grand_total - paid) * invoice.exchange_rate
    return _q2(total)


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
    # Fix 2: "Invoiced" = NET of TAX_INVOICE - CREDIT_NOTE by issue_date (non-draft, non-void, customer only)
    invoice_query = (
        select(Invoice)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.customer_id.is_not(None),
            Invoice.status != InvoiceStatus.DRAFT,
            Invoice.status != InvoiceStatus.VOID,
            Invoice.type.in_([InvoiceType.TAX_INVOICE, InvoiceType.CREDIT_NOTE]),
        )
    )
    invoices = list((await db.execute(invoice_query)).scalars().all())

    invoiced_totals: dict[str, Decimal] = {}
    for invoice in invoices:
        period = invoice.issue_date.strftime("%Y-%m")
        base_total = invoice.grand_total * invoice.exchange_rate
        current = invoiced_totals.get(period, Decimal("0"))
        if invoice.type == InvoiceType.CREDIT_NOTE:
            invoiced_totals[period] = current - base_total
        else:
            invoiced_totals[period] = current + base_total

    # Fix 2: "Collected" = SUM(payment_allocation.amount_allocated * invoice.exchange_rate)
    # grouped by payment.payment_date month, customer payments only, excluding voided/bounced
    collected_query = (
        select(
            func.to_char(Payment.payment_date, "YYYY-MM").label("period"),
            func.coalesce(
                func.sum(PaymentAllocation.amount_allocated * Invoice.exchange_rate), 0
            ).label("collected"),
        )
        .join(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
        .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.customer_id.is_not(None),
            Payment.voided_at.is_(None),
            or_(Payment.cheque_status.is_(None), Payment.cheque_status != ChequeStatus.BOUNCED),
        )
        .group_by(func.to_char(Payment.payment_date, "YYYY-MM"))
    )
    collected_rows = (await db.execute(collected_query)).all()
    collected_totals: dict[str, Decimal] = {row.period: Decimal(str(row.collected)) for row in collected_rows}

    all_periods = set(invoiced_totals.keys()) | set(collected_totals.keys())
    periods = sorted(all_periods, reverse=True)[:months]

    return [
        (p, _q2(invoiced_totals.get(p, Decimal("0"))), _q2(collected_totals.get(p, Decimal("0"))))
        for p in reversed(periods)
    ]


async def top_customers(db: AsyncSession, tenant_id: uuid.UUID, limit: int = 5) -> list[tuple[uuid.UUID, str, Decimal, Decimal]]:
    base_total = Invoice.grand_total * Invoice.exchange_rate
    query = (
        select(
            Customer.id,
            Customer.name,
            func.coalesce(func.sum(base_total), 0).label("total_invoiced"),
            func.coalesce(func.sum(base_total).filter(Invoice.status == InvoiceStatus.PAID), 0).label(
                "total_paid"
            ),
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .where(Customer.tenant_id == tenant_id, Invoice.status != InvoiceStatus.VOID)
        .group_by(Customer.id, Customer.name)
        .order_by(func.coalesce(func.sum(base_total), 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [(row.id, row.name, _q2(row.total_invoiced), _q2(row.total_paid)) for row in rows]


async def top_items(db: AsyncSession, tenant_id: uuid.UUID, limit: int = 5) -> list[tuple[uuid.UUID | None, str, Decimal, Decimal]]:
    base_revenue = InvoiceLineItem.line_total * Invoice.exchange_rate
    query = (
        select(
            InvoiceLineItem.item_id,
            func.max(InvoiceLineItem.description).label("description"),
            func.coalesce(func.sum(InvoiceLineItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(base_revenue), 0).label("revenue"),
        )
        .join(Invoice, Invoice.id == InvoiceLineItem.invoice_id)
        .where(Invoice.tenant_id == tenant_id, Invoice.status != InvoiceStatus.VOID)
        .group_by(InvoiceLineItem.item_id, InvoiceLineItem.description)
        .order_by(func.coalesce(func.sum(base_revenue), 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [(row.item_id, row.description, row.quantity, _q2(row.revenue)) for row in rows]


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
        balance = (invoice.grand_total - await get_paid_amount(db, invoice.id)) * invoice.exchange_rate
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

    return [(label, _q2(total), count) for label, (total, count) in buckets.items()]


async def vat_summary(
    db: AsyncSession, tenant_id: uuid.UUID, *, date_from: date | None, date_to: date | None
) -> tuple[Decimal, Decimal]:
    invoice_query = select(func.coalesce(func.sum(Invoice.vat_total * Invoice.exchange_rate), 0)).where(
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
    return _q2(output_vat), input_vat


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
                amount=_q2(invoice.grand_total * invoice.exchange_rate),
                direction=INVOICE_DAY_BOOK_DIRECTIONS[invoice.type],
            )
        )

    # Fix 4: Use allocation-based exchange_rate conversion; exclude voided/bounced payments
    payment_query = (
        select(
            Payment.id,
            Payment.payment_date,
            Payment.customer_id,
            Payment.supplier_id,
            Payment.reference_no,
            Customer.name.label("customer_name"),
            Supplier.name.label("supplier_name"),
            func.coalesce(
                func.sum(PaymentAllocation.amount_allocated * Invoice.exchange_rate),
                Payment.amount,
            ).label("base_amount"),
        )
        .outerjoin(Customer, Payment.customer_id == Customer.id)
        .outerjoin(Supplier, Payment.supplier_id == Supplier.id)
        .outerjoin(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
        .outerjoin(Invoice, Invoice.id == PaymentAllocation.invoice_id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.payment_date >= date_from,
            Payment.payment_date <= date_to,
            Payment.voided_at.is_(None),
            or_(Payment.cheque_status.is_(None), Payment.cheque_status != ChequeStatus.BOUNCED),
        )
        .group_by(
            Payment.id,
            Payment.payment_date,
            Payment.customer_id,
            Payment.supplier_id,
            Payment.reference_no,
            Customer.name,
            Supplier.name,
        )
    )
    for row in (await db.execute(payment_query)).all():
        entries.append(
            DayBookEntry(
                id=row.id,
                entry_date=row.payment_date,
                type="payment",
                reference=row.reference_no or "Payment",
                party_name=row.customer_name or row.supplier_name,
                amount=_q2(row.base_amount),
                direction="in" if row.customer_id is not None else "out",
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


async def outstanding_payables(db: AsyncSession, tenant_id: uuid.UUID) -> Decimal:
    query = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.supplier_id.is_not(None),
        Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
    )
    invoices = list((await db.execute(query)).scalars().all())
    total = Decimal("0")
    for invoice in invoices:
        paid = await get_paid_amount(db, invoice.id)
        total += (invoice.grand_total - paid) * invoice.exchange_rate
    return _q2(total)


async def cash_and_bank_balance(db: AsyncSession, tenant_id: uuid.UUID) -> Decimal:
    # Fix 5: Use allocation-based amounts (amount_allocated * exchange_rate) for proper base-currency conversion
    # Exclude voided payments and bounced cheques
    received_query = (
        select(func.coalesce(func.sum(PaymentAllocation.amount_allocated * Invoice.exchange_rate), 0))
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.customer_id.is_not(None),
            Payment.voided_at.is_(None),
            or_(Payment.cheque_status.is_(None), Payment.cheque_status != ChequeStatus.BOUNCED),
        )
    )
    paid_to_suppliers_query = (
        select(func.coalesce(func.sum(PaymentAllocation.amount_allocated * Invoice.exchange_rate), 0))
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.supplier_id.is_not(None),
            Payment.voided_at.is_(None),
            or_(Payment.cheque_status.is_(None), Payment.cheque_status != ChequeStatus.BOUNCED),
        )
    )
    expenses_query = select(func.coalesce(func.sum(ExpenseEntry.amount), 0)).where(
        ExpenseEntry.tenant_id == tenant_id
    )
    received = (await db.execute(received_query)).scalar_one()
    paid_to_suppliers = (await db.execute(paid_to_suppliers_query)).scalar_one()
    expenses = (await db.execute(expenses_query)).scalar_one()
    return _q2(received - paid_to_suppliers - expenses)


async def profit_loss(
    db: AsyncSession, tenant_id: uuid.UUID, *, date_from: date | None, date_to: date | None
) -> tuple[Decimal, Decimal, Decimal, list[ExpenseCategoryTotal], Decimal]:
    def apply_date_filter(query):
        if date_from is not None:
            query = query.where(Invoice.issue_date >= date_from)
        if date_to is not None:
            query = query.where(Invoice.issue_date <= date_to)
        return query

    # Fix 3: Use (subtotal - discount_total) instead of subtotal to account for document-level discount
    base_subtotal = (Invoice.subtotal - Invoice.discount_total) * Invoice.exchange_rate
    revenue_query = apply_date_filter(
        select(func.coalesce(func.sum(base_subtotal), 0)).where(
            Invoice.tenant_id == tenant_id, Invoice.type == InvoiceType.TAX_INVOICE, Invoice.status != InvoiceStatus.DRAFT, Invoice.status != InvoiceStatus.VOID
        )
    )
    returns_query = apply_date_filter(
        select(func.coalesce(func.sum(base_subtotal), 0)).where(
            Invoice.tenant_id == tenant_id, Invoice.type == InvoiceType.CREDIT_NOTE, Invoice.status != InvoiceStatus.DRAFT, Invoice.status != InvoiceStatus.VOID
        )
    )

    sales_revenue = _q2((await db.execute(revenue_query)).scalar_one())
    sales_returns = _q2((await db.execute(returns_query)).scalar_one())

    cogs_query = (
        select(
            InvoiceLineItem.quantity,
            Item.purchase_price,
            Invoice.type,
            Invoice.exchange_rate,
        )
        .join(Invoice, Invoice.id == InvoiceLineItem.invoice_id)
        .outerjoin(Item, Item.id == InvoiceLineItem.item_id)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.status != InvoiceStatus.DRAFT,
            Invoice.status != InvoiceStatus.VOID,
            Invoice.type.in_([InvoiceType.TAX_INVOICE, InvoiceType.CREDIT_NOTE]),
        )
    )
    cogs_query = apply_date_filter(cogs_query)

    cost_of_goods_sold = Decimal("0")
    for quantity, purchase_price, invoice_type, exchange_rate in (await db.execute(cogs_query)).all():
        if purchase_price is None:
            continue
        line_cost = quantity * purchase_price * exchange_rate
        if invoice_type == InvoiceType.CREDIT_NOTE:
            cost_of_goods_sold -= line_cost
        else:
            cost_of_goods_sold += line_cost

    expense_query = select(
        ExpenseEntry.category, func.coalesce(func.sum(ExpenseEntry.amount), 0)
    ).where(ExpenseEntry.tenant_id == tenant_id)
    if date_from is not None:
        expense_query = expense_query.where(ExpenseEntry.expense_date >= date_from)
    if date_to is not None:
        expense_query = expense_query.where(ExpenseEntry.expense_date <= date_to)
    expense_query = expense_query.group_by(ExpenseEntry.category).order_by(ExpenseEntry.category)

    expenses_by_category = [
        ExpenseCategoryTotal(category=category, amount=amount)
        for category, amount in (await db.execute(expense_query)).all()
    ]
    total_expenses = sum((e.amount for e in expenses_by_category), Decimal("0"))

    return sales_revenue, sales_returns, _q2(cost_of_goods_sold), expenses_by_category, total_expenses


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
