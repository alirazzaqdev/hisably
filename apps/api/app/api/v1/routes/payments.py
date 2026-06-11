import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.enums import PaymentMethod
from app.models.payment import Payment
from app.models.tenant import Tenant
from app.repositories import payments as payments_repo
from app.schemas.common import Page
from app.schemas.payment import ChequeStatusUpdate, PaymentAllocationOut, PaymentCreate, PaymentOut, ReceivableOut

router = APIRouter(tags=["payments"])


def _to_out(payment: Payment) -> PaymentOut:
    out = PaymentOut.model_validate(payment)
    out.allocations = [PaymentAllocationOut.model_validate(a) for a in getattr(payment, "allocations_loaded", [])]
    return out


@router.get("/payments", response_model=Page[PaymentOut])
async def list_payments(
    customer_id: uuid.UUID | None = Query(default=None),
    supplier_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[PaymentOut]:
    items, total = await payments_repo.list_paginated(
        db, tenant.id, customer_id=customer_id, supplier_id=supplier_id, page=page, page_size=page_size
    )
    return Page(items=[_to_out(p) for p in items], total=total, page=page, page_size=page_size)


@router.post("/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PaymentOut:
    try:
        payment = await payments_repo.create(db, tenant.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    await db.commit()
    return _to_out(payment)


@router.get("/payments/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PaymentOut:
    payment = await payments_repo.get_by_id(db, tenant.id, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return _to_out(payment)


@router.patch("/payments/{payment_id}/cheque-status", response_model=PaymentOut)
async def update_cheque_status(
    payment_id: uuid.UUID,
    payload: ChequeStatusUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PaymentOut:
    payment = await payments_repo.get_by_id(db, tenant.id, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.method != PaymentMethod.CHEQUE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This payment is not a cheque")
    payment = await payments_repo.update_cheque_status(db, tenant.id, payment, payload.cheque_status)
    await db.commit()
    return _to_out(payment)


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    payment = await payments_repo.get_by_id(db, tenant.id, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    await payments_repo.delete(db, tenant.id, payment)
    await db.commit()


@router.get("/receivables", response_model=list[ReceivableOut])
async def get_receivables(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ReceivableOut]:
    invoices = await payments_repo.list_receivables(db, tenant.id)
    result = []
    for invoice in invoices:
        paid = await payments_repo.get_paid_amount(db, invoice.id)
        result.append(
            ReceivableOut(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                draft_number=invoice.draft_number,
                customer_id=invoice.customer_id,
                issue_date=invoice.issue_date,
                due_date=invoice.due_date,
                currency=invoice.currency,
                grand_total=invoice.grand_total,
                paid_amount=paid,
                balance_due=invoice.grand_total - paid,
                status=invoice.status.value,
            )
        )
    return result


@router.get("/payables", response_model=list[ReceivableOut])
async def get_payables(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ReceivableOut]:
    invoices = await payments_repo.list_payables(db, tenant.id)
    result = []
    for invoice in invoices:
        paid = await payments_repo.get_paid_amount(db, invoice.id)
        result.append(
            ReceivableOut(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                draft_number=invoice.draft_number,
                customer_id=invoice.supplier_id,
                issue_date=invoice.issue_date,
                due_date=invoice.due_date,
                currency=invoice.currency,
                grand_total=invoice.grand_total,
                paid_amount=paid,
                balance_due=invoice.grand_total - paid,
                status=invoice.status.value,
            )
        )
    return result
