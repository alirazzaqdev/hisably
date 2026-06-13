import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.enums import JobPaymentStatus, JobTaxInvoiceStatus, JobWorkStatus
from app.models.tenant import Tenant
from app.repositories import job_register as job_register_repo
from app.schemas.common import Page
from app.schemas.job_register import (
    JobReceiptCreate,
    JobReceiptOut,
    JobReceiptUpdate,
    JobRegisterRowCreate,
    JobRegisterRowOut,
    JobRegisterRowUpdate,
    JobRegisterSummary,
)

router = APIRouter(prefix="/job-register", tags=["job-register"])


@router.get("/rows", response_model=Page[JobRegisterRowOut])
async def list_rows(
    customer_id: uuid.UUID | None = Query(default=None),
    work_status: JobWorkStatus | None = Query(default=None),
    tax_invoice_status: JobTaxInvoiceStatus | None = Query(default=None),
    payment_status: JobPaymentStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[JobRegisterRowOut]:
    items, total = await job_register_repo.list_rows(
        db,
        tenant.id,
        customer_id=customer_id,
        work_status=work_status,
        tax_invoice_status=tax_invoice_status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        page=page,
        page_size=page_size,
    )
    return Page(
        items=[JobRegisterRowOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/rows", response_model=JobRegisterRowOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: JobRegisterRowCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> JobRegisterRowOut:
    row = await job_register_repo.create_row(db, tenant.id, payload)
    await db.commit()
    return JobRegisterRowOut.model_validate(row)


@router.patch("/rows/{row_id}", response_model=JobRegisterRowOut)
async def update_row(
    row_id: uuid.UUID,
    payload: JobRegisterRowUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> JobRegisterRowOut:
    row = await job_register_repo.get_row_by_id(db, tenant.id, row_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job register row not found")
    row = await job_register_repo.update_row(db, row, payload)
    await db.commit()
    return JobRegisterRowOut.model_validate(row)


@router.delete("/rows/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = await job_register_repo.get_row_by_id(db, tenant.id, row_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job register row not found")
    await job_register_repo.delete_row(db, row)
    await db.commit()


@router.get("/summary", response_model=JobRegisterSummary)
async def get_summary(
    customer_id: uuid.UUID | None = Query(default=None),
    work_status: JobWorkStatus | None = Query(default=None),
    tax_invoice_status: JobTaxInvoiceStatus | None = Query(default=None),
    payment_status: JobPaymentStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> JobRegisterSummary:
    rows = await job_register_repo.all_rows_for_summary(
        db,
        tenant.id,
        customer_id=customer_id,
        work_status=work_status,
        tax_invoice_status=tax_invoice_status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    def row_total(row) -> Decimal:
        return row.override_total if row.override_total is not None else row.rate + row.vat

    total_work_value = sum((row_total(row) for row in rows), Decimal("0"))
    total_submitted = sum(
        (row_total(row) for row in rows if row.tax_invoice_status == JobTaxInvoiceStatus.SUBMITTED),
        Decimal("0"),
    )
    total_received_by_status = sum(
        (row_total(row) for row in rows if row.payment_status == JobPaymentStatus.RECEIVED),
        Decimal("0"),
    )
    total_received = await job_register_repo.total_receipts(db, tenant.id)

    return JobRegisterSummary(
        total_work_value=total_work_value,
        total_submitted=total_submitted,
        total_received=total_received,
        total_received_by_status=total_received_by_status,
        balance=total_work_value - total_received,
    )


@router.get("/receipts", response_model=list[JobReceiptOut])
async def list_receipts(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[JobReceiptOut]:
    receipts = await job_register_repo.list_receipts(db, tenant.id)
    return [JobReceiptOut.model_validate(receipt) for receipt in receipts]


@router.post("/receipts", response_model=JobReceiptOut, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    payload: JobReceiptCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> JobReceiptOut:
    receipt = await job_register_repo.create_receipt(db, tenant.id, payload)
    await db.commit()
    return JobReceiptOut.model_validate(receipt)


@router.patch("/receipts/{receipt_id}", response_model=JobReceiptOut)
async def update_receipt(
    receipt_id: uuid.UUID,
    payload: JobReceiptUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> JobReceiptOut:
    receipt = await job_register_repo.get_receipt_by_id(db, tenant.id, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    receipt = await job_register_repo.update_receipt(db, receipt, payload)
    await db.commit()
    return JobReceiptOut.model_validate(receipt)


@router.delete("/receipts/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    receipt = await job_register_repo.get_receipt_by_id(db, tenant.id, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    await job_register_repo.delete_receipt(db, receipt)
    await db.commit()
