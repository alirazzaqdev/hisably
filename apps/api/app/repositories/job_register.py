import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import JobPaymentStatus, JobTaxInvoiceStatus, JobWorkStatus
from app.models.job_register import JobReceipt, JobRegisterRow
from app.schemas.job_register import (
    JobReceiptCreate,
    JobReceiptUpdate,
    JobRegisterRowCreate,
    JobRegisterRowUpdate,
)

VAT_RATE = Decimal("0.05")


def compute_vat(rate: Decimal) -> Decimal:
    return (rate * VAT_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def create_row(db: AsyncSession, tenant_id: uuid.UUID, payload: JobRegisterRowCreate) -> JobRegisterRow:
    data = payload.model_dump(exclude={"client_uuid"})
    row = JobRegisterRow(
        tenant_id=tenant_id,
        client_uuid=payload.client_uuid or uuid.uuid4(),
        vat=compute_vat(data["rate"]),
        **data,
    )
    db.add(row)
    await db.flush()
    return row


async def get_row_by_id(db: AsyncSession, tenant_id: uuid.UUID, row_id: uuid.UUID) -> JobRegisterRow | None:
    result = await db.execute(
        select(JobRegisterRow).where(JobRegisterRow.id == row_id, JobRegisterRow.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_rows(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    customer_id: uuid.UUID | None,
    work_status: JobWorkStatus | None,
    tax_invoice_status: JobTaxInvoiceStatus | None,
    payment_status: JobPaymentStatus | None,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[list[JobRegisterRow], int]:
    query = select(JobRegisterRow).where(JobRegisterRow.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(JobRegisterRow).where(JobRegisterRow.tenant_id == tenant_id)

    if customer_id is not None:
        query = query.where(JobRegisterRow.customer_id == customer_id)
        count_query = count_query.where(JobRegisterRow.customer_id == customer_id)
    if work_status is not None:
        query = query.where(JobRegisterRow.work_status == work_status)
        count_query = count_query.where(JobRegisterRow.work_status == work_status)
    if tax_invoice_status is not None:
        query = query.where(JobRegisterRow.tax_invoice_status == tax_invoice_status)
        count_query = count_query.where(JobRegisterRow.tax_invoice_status == tax_invoice_status)
    if payment_status is not None:
        query = query.where(JobRegisterRow.payment_status == payment_status)
        count_query = count_query.where(JobRegisterRow.payment_status == payment_status)
    if date_from is not None:
        query = query.where(JobRegisterRow.created_at >= date_from)
        count_query = count_query.where(JobRegisterRow.created_at >= date_from)
    if date_to is not None:
        query = query.where(JobRegisterRow.created_at <= date_to)
        count_query = count_query.where(JobRegisterRow.created_at <= date_to)
    if search:
        like = f"%{search}%"
        condition = (
            JobRegisterRow.description.ilike(like)
            | JobRegisterRow.villa_no.ilike(like)
            | JobRegisterRow.lpo_no.ilike(like)
            | JobRegisterRow.qt_no.ilike(like)
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(JobRegisterRow.sort_order.asc(), JobRegisterRow.created_at.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    items = list((await db.execute(query)).scalars().all())
    return items, total


async def update_row(db: AsyncSession, row: JobRegisterRow, payload: JobRegisterRowUpdate) -> JobRegisterRow:
    data = payload.model_dump(exclude_unset=True, exclude={"clear_override_total"})

    if payload.clear_override_total:
        row.override_total = None

    for field, value in data.items():
        setattr(row, field, value)

    if "rate" in data:
        row.vat = compute_vat(row.rate)

    await db.flush()
    return row


async def delete_row(db: AsyncSession, row: JobRegisterRow) -> None:
    await db.delete(row)
    await db.flush()


async def create_receipt(db: AsyncSession, tenant_id: uuid.UUID, payload: JobReceiptCreate) -> JobReceipt:
    receipt = JobReceipt(
        tenant_id=tenant_id,
        client_uuid=payload.client_uuid or uuid.uuid4(),
        **payload.model_dump(exclude={"client_uuid"}),
    )
    db.add(receipt)
    await db.flush()
    return receipt


async def get_receipt_by_id(db: AsyncSession, tenant_id: uuid.UUID, receipt_id: uuid.UUID) -> JobReceipt | None:
    result = await db.execute(
        select(JobReceipt).where(JobReceipt.id == receipt_id, JobReceipt.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_receipts(db: AsyncSession, tenant_id: uuid.UUID) -> list[JobReceipt]:
    result = await db.execute(
        select(JobReceipt).where(JobReceipt.tenant_id == tenant_id).order_by(JobReceipt.receipt_date.desc())
    )
    return list(result.scalars().all())


async def update_receipt(db: AsyncSession, receipt: JobReceipt, payload: JobReceiptUpdate) -> JobReceipt:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(receipt, field, value)
    await db.flush()
    return receipt


async def delete_receipt(db: AsyncSession, receipt: JobReceipt) -> None:
    await db.delete(receipt)
    await db.flush()


async def total_receipts(db: AsyncSession, tenant_id: uuid.UUID) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(JobReceipt.amount), 0)).where(JobReceipt.tenant_id == tenant_id)
    )
    return Decimal(result.scalar_one())


async def all_rows_for_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    customer_id: uuid.UUID | None,
    work_status: JobWorkStatus | None,
    tax_invoice_status: JobTaxInvoiceStatus | None,
    payment_status: JobPaymentStatus | None,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
) -> list[JobRegisterRow]:
    items, _ = await list_rows(
        db,
        tenant_id,
        customer_id=customer_id,
        work_status=work_status,
        tax_invoice_status=tax_invoice_status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        page=1,
        page_size=100000,
    )
    return items
