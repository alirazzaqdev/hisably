import uuid
from decimal import Decimal

from sqlalchemy import delete as sa_delete
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ChequeStatus, InvoiceStatus, PaymentMethod
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentAllocation
from app.schemas.payment import PaymentCreate


async def get_paid_amount(db: AsyncSession, invoice_id: uuid.UUID) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(PaymentAllocation.amount_allocated), 0))
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .where(
            PaymentAllocation.invoice_id == invoice_id,
            or_(Payment.cheque_status.is_(None), Payment.cheque_status != ChequeStatus.BOUNCED),
        )
    )
    return result.scalar_one()


async def _refresh_invoice_status(db: AsyncSession, invoice: Invoice) -> None:
    if invoice.status in (InvoiceStatus.DRAFT, InvoiceStatus.VOID):
        return
    paid = await get_paid_amount(db, invoice.id)
    if paid <= 0:
        invoice.status = InvoiceStatus.SENT
    elif paid >= invoice.grand_total:
        invoice.status = InvoiceStatus.PAID
    else:
        invoice.status = InvoiceStatus.PARTIALLY_PAID
    await db.flush()


async def get_allocations(db: AsyncSession, payment_id: uuid.UUID) -> list[PaymentAllocation]:
    result = await db.execute(select(PaymentAllocation).where(PaymentAllocation.payment_id == payment_id))
    return list(result.scalars().all())


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: PaymentCreate) -> Payment:
    payment = Payment(
        tenant_id=tenant_id,
        customer_id=payload.customer_id,
        supplier_id=payload.supplier_id,
        account_id=payload.account_id,
        amount=payload.amount,
        method=payload.method,
        reference_no=payload.reference_no,
        payment_date=payload.payment_date,
        notes=payload.notes,
        cheque_number=payload.cheque_number,
        cheque_date=payload.cheque_date,
        cheque_status=ChequeStatus.PENDING if payload.method == PaymentMethod.CHEQUE else None,
        client_uuid=payload.client_uuid or uuid.uuid4(),
    )
    db.add(payment)
    await db.flush()

    allocations: list[PaymentAllocation] = []
    for alloc in payload.allocations:
        result = await db.execute(
            select(Invoice).where(Invoice.id == alloc.invoice_id, Invoice.tenant_id == tenant_id)
        )
        invoice = result.scalar_one_or_none()
        if invoice is None:
            raise ValueError(f"Invoice {alloc.invoice_id} not found")

        allocation = PaymentAllocation(payment_id=payment.id, invoice_id=alloc.invoice_id, amount_allocated=alloc.amount)
        db.add(allocation)
        allocations.append(allocation)
        await db.flush()
        await _refresh_invoice_status(db, invoice)

    payment.allocations_loaded = allocations
    return payment


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, payment_id: uuid.UUID) -> Payment | None:
    result = await db.execute(select(Payment).where(Payment.id == payment_id, Payment.tenant_id == tenant_id))
    payment = result.scalar_one_or_none()
    if payment is not None:
        payment.allocations_loaded = await get_allocations(db, payment.id)
    return payment


async def list_paginated(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    customer_id: uuid.UUID | None,
    supplier_id: uuid.UUID | None,
    page: int,
    page_size: int,
) -> tuple[list[Payment], int]:
    query = select(Payment).where(Payment.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(Payment).where(Payment.tenant_id == tenant_id)

    if customer_id is not None:
        query = query.where(Payment.customer_id == customer_id)
        count_query = count_query.where(Payment.customer_id == customer_id)
    if supplier_id is not None:
        query = query.where(Payment.supplier_id == supplier_id)
        count_query = count_query.where(Payment.supplier_id == supplier_id)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    payments = list((await db.execute(query)).scalars().all())
    for payment in payments:
        payment.allocations_loaded = await get_allocations(db, payment.id)
    return payments, total


async def update_cheque_status(db: AsyncSession, tenant_id: uuid.UUID, payment: Payment, status: ChequeStatus) -> Payment:
    payment.cheque_status = status
    await db.flush()

    allocations = await get_allocations(db, payment.id)
    for alloc in allocations:
        result = await db.execute(
            select(Invoice).where(Invoice.id == alloc.invoice_id, Invoice.tenant_id == tenant_id)
        )
        invoice = result.scalar_one_or_none()
        if invoice is not None:
            await _refresh_invoice_status(db, invoice)

    payment.allocations_loaded = allocations
    return payment


async def delete(db: AsyncSession, tenant_id: uuid.UUID, payment: Payment) -> None:
    allocations = await get_allocations(db, payment.id)
    invoice_ids = {alloc.invoice_id for alloc in allocations}

    await db.execute(sa_delete(PaymentAllocation).where(PaymentAllocation.payment_id == payment.id))
    await db.delete(payment)
    await db.flush()

    for invoice_id in invoice_ids:
        result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id))
        invoice = result.scalar_one_or_none()
        if invoice is not None:
            await _refresh_invoice_status(db, invoice)


async def list_receivables(db: AsyncSession, tenant_id: uuid.UUID) -> list[Invoice]:
    query = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.customer_id.is_not(None),
        Invoice.status.in_(
            [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]
        ),
    ).order_by(Invoice.due_date.asc().nulls_last(), Invoice.issue_date.asc())
    return list((await db.execute(query)).scalars().all())


async def list_payables(db: AsyncSession, tenant_id: uuid.UUID) -> list[Invoice]:
    query = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.supplier_id.is_not(None),
        Invoice.status.in_(
            [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]
        ),
    ).order_by(Invoice.due_date.asc().nulls_last(), Invoice.issue_date.asc())
    return list((await db.execute(query)).scalars().all())
