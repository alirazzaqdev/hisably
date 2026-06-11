import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.api.v1.routes.invoices import _to_out as _invoice_to_out
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import recurring_invoices as recurring_repo
from app.schemas.common import Page
from app.schemas.invoice import InvoiceOut
from app.schemas.recurring_invoice import RecurringInvoiceCreate, RecurringInvoiceOut, RecurringInvoiceUpdate

router = APIRouter(prefix="/recurring-invoices", tags=["recurring-invoices"])


@router.get("", response_model=Page[RecurringInvoiceOut])
async def list_recurring_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[RecurringInvoiceOut]:
    items, total = await recurring_repo.list_paginated(db, tenant.id, page=page, page_size=page_size)
    return Page(
        items=[RecurringInvoiceOut.model_validate(r) for r in items], total=total, page=page, page_size=page_size
    )


@router.post("", response_model=RecurringInvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_recurring_invoice(
    payload: RecurringInvoiceCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> RecurringInvoiceOut:
    recurring = await recurring_repo.create(db, tenant.id, payload)
    await db.commit()
    return RecurringInvoiceOut.model_validate(recurring)


@router.get("/{recurring_id}", response_model=RecurringInvoiceOut)
async def get_recurring_invoice(
    recurring_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> RecurringInvoiceOut:
    recurring = await recurring_repo.get_by_id(db, tenant.id, recurring_id)
    if recurring is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    return RecurringInvoiceOut.model_validate(recurring)


@router.patch("/{recurring_id}", response_model=RecurringInvoiceOut)
async def update_recurring_invoice(
    recurring_id: uuid.UUID,
    payload: RecurringInvoiceUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> RecurringInvoiceOut:
    recurring = await recurring_repo.get_by_id(db, tenant.id, recurring_id)
    if recurring is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    recurring = await recurring_repo.update(db, recurring, payload)
    await db.commit()
    return RecurringInvoiceOut.model_validate(recurring)


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_invoice(
    recurring_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    recurring = await recurring_repo.get_by_id(db, tenant.id, recurring_id)
    if recurring is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    await recurring_repo.delete(db, recurring)
    await db.commit()


@router.post("/{recurring_id}/generate-now", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def generate_recurring_invoice_now(
    recurring_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    recurring = await recurring_repo.get_by_id(db, tenant.id, recurring_id)
    if recurring is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring invoice not found")
    if not recurring.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recurring invoice is not active")
    invoice = await recurring_repo.generate_invoice(db, tenant, recurring)
    await db.commit()
    return _invoice_to_out(invoice)


@router.post("/run-due", response_model=list[InvoiceOut])
async def run_due_recurring_invoices(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[InvoiceOut]:
    due = await recurring_repo.list_due(db, tenant.id, today=date.today())
    invoices = []
    for recurring in due:
        invoices.append(await recurring_repo.generate_invoice(db, tenant, recurring))
    await db.commit()
    return [_invoice_to_out(i) for i in invoices]
