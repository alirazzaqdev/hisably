from datetime import date
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.core.email import send_quotation_expired_email
from app.db.session import get_db
from app.models.enums import QuotationStatus
from app.models.invoice import Invoice
from app.models.tenant import Tenant
from app.repositories import customers as customers_repo
from app.repositories import invoices as invoices_repo
from app.repositories import users as users_repo
from app.schemas.common import Page
from app.schemas.invoice import InvoiceLineItemOut, InvoiceOut, QuotationCounts, QuotationStatusUpdate

router = APIRouter(prefix="/quotations", tags=["quotations"])

# Manual status transitions allowed via the row-action menu. PENDING -> EXPIRED
# happens automatically based on due_date, not through this endpoint.
ALLOWED_TRANSITIONS: dict[QuotationStatus, set[QuotationStatus]] = {
    QuotationStatus.DRAFT: {QuotationStatus.PENDING},
    QuotationStatus.PENDING: {QuotationStatus.APPROVED, QuotationStatus.REJECTED},
    QuotationStatus.EXPIRED: {QuotationStatus.PENDING},
}


async def _notify_expired_quotations(db: AsyncSession, tenant: Tenant) -> None:
    expired = await invoices_repo.list_newly_expired_quotations(db, tenant.id)
    if not expired:
        return

    owner = await users_repo.get_owner(db, tenant.id)
    for invoice in expired:
        if owner is not None:
            customer = await customers_repo.get_by_id(db, tenant.id, invoice.customer_id) if invoice.customer_id else None
            send_quotation_expired_email(
                owner.email,
                invoice.invoice_number or invoice.draft_number,
                customer.name if customer else "—",
                invoice.due_date.isoformat() if invoice.due_date else "—",
            )
        await invoices_repo.mark_expiry_notified(db, invoice)
    await db.commit()


def _to_out(invoice: Invoice) -> InvoiceOut:
    out = InvoiceOut.model_validate(invoice)
    out.line_items = [InvoiceLineItemOut.model_validate(li) for li in getattr(invoice, "line_items_loaded", [])]
    out.effective_quotation_status = invoices_repo.effective_quotation_status(invoice)
    return out


@router.get("", response_model=Page[InvoiceOut])
async def list_quotations(
    search: str | None = Query(default=None),
    status_filter: QuotationStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[InvoiceOut]:
    # Expiry check is now handled by the daily cron job (POST /internal/daily-jobs).
    # We keep a lightweight on-demand flip so the status column stays current
    # even if the cron hasn't run yet today.
    await invoices_repo.flip_expired_quotations(db, tenant.id)
    await db.commit()
    items, total = await invoices_repo.list_quotations(
        db, tenant.id, status=status_filter, search=search, page=page, page_size=page_size
    )
    return Page(items=[_to_out(i) for i in items], total=total, page=page, page_size=page_size)


@router.get("/counts", response_model=QuotationCounts)
async def get_quotation_counts(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> QuotationCounts:
    await invoices_repo.flip_expired_quotations(db, tenant.id)
    await db.commit()
    counts = await invoices_repo.count_quotations_by_status(db, tenant.id)
    return QuotationCounts(
        draft=counts[QuotationStatus.DRAFT.value],
        pending=counts[QuotationStatus.PENDING.value],
        approved=counts[QuotationStatus.APPROVED.value],
        rejected=counts[QuotationStatus.REJECTED.value],
        expired=counts[QuotationStatus.EXPIRED.value],
        total=counts["total"],
    )


@router.patch("/{quotation_id}/status", response_model=InvoiceOut)
async def update_quotation_status(
    quotation_id: uuid.UUID,
    payload: QuotationStatusUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InvoiceOut:
    invoice = await invoices_repo.get_by_id(db, tenant.id, quotation_id)
    if invoice is None or invoice.quotation_status is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    current = invoices_repo.effective_quotation_status(invoice)
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change quotation status from {current.value} to {payload.status.value}",
        )

    due_date = payload.due_date
    if payload.status == QuotationStatus.PENDING:
        if due_date is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="due_date is required to renew a quotation")
        if due_date < date.today():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="due_date must be today or later")

    invoice = await invoices_repo.set_quotation_status(db, invoice, payload.status, due_date)
    await db.commit()
    return _to_out(invoice)
