import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.enums import InvoiceStatus, InvoiceType
from app.models.invoice import Invoice
from app.models.tenant import Tenant
from app.repositories import customers as customers_repo
from app.repositories import invoices as invoices_repo
from app.schemas.common import Page
from app.schemas.invoice import InvoiceCreate, InvoiceLineItemOut, InvoiceOut, InvoiceStatusUpdate, InvoiceUpdate
from app.services.invoice_pdf import render_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _to_out(invoice: Invoice) -> InvoiceOut:
    out = InvoiceOut.model_validate(invoice)
    out.line_items = [InvoiceLineItemOut.model_validate(li) for li in getattr(invoice, "line_items_loaded", [])]
    return out


@router.get("", response_model=Page[InvoiceOut])
async def list_invoices(
    search: str | None = Query(default=None),
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    type_filter: InvoiceType | None = Query(default=None, alias="type"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[InvoiceOut]:
    items, total = await invoices_repo.list_paginated(
        db, tenant.id, search=search, status=status_filter, type=type_filter, page=page, page_size=page_size
    )
    return Page(items=[_to_out(i) for i in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    invoice = await invoices_repo.create(db, tenant, payload)
    await db.commit()
    return _to_out(invoice)


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    invoice = await invoices_repo.get_by_id(db, tenant.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return _to_out(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    invoice = await invoices_repo.get_by_id(db, tenant.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.SENT):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft or sent invoices can be edited")
    invoice = await invoices_repo.update(db, tenant, invoice, payload)
    await db.commit()
    return _to_out(invoice)


@router.patch("/{invoice_id}/status", response_model=InvoiceOut)
async def update_invoice_status(
    invoice_id: uuid.UUID,
    payload: InvoiceStatusUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    invoice = await invoices_repo.get_by_id(db, tenant.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status == InvoiceStatus.VOID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invoice is already void")
    invoice = await invoices_repo.set_status(db, invoice, payload.status, payload.void_reason)
    await db.commit()
    return _to_out(invoice)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    invoice = await invoices_repo.get_by_id(db, tenant.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft invoices can be deleted")
    await invoices_repo.delete(db, invoice)
    await db.commit()


@router.post("/{invoice_id}/share", response_model=InvoiceOut)
async def share_invoice(
    invoice_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    invoice = await invoices_repo.get_by_id(db, tenant.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    await invoices_repo.ensure_public_token(db, invoice)
    await db.commit()
    return _to_out(invoice)


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Response:
    invoice = await invoices_repo.get_by_id(db, tenant.id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    customer = None
    if invoice.customer_id is not None:
        customer = await customers_repo.get_by_id(db, tenant.id, invoice.customer_id)

    pdf_bytes = render_invoice_pdf(invoice, tenant, customer)
    filename = f"{invoice.invoice_number or invoice.draft_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
