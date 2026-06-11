from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import customers as customers_repo
from app.repositories import invoices as invoices_repo
from app.repositories import tenants as tenants_repo
from app.services.invoice_pdf import render_invoice_pdf

router = APIRouter(prefix="/public/invoices", tags=["public"])


@router.get("/{public_token}/pdf")
async def get_public_invoice_pdf(
    public_token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    invoice = await invoices_repo.get_by_public_token(db, public_token)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    tenant = await tenants_repo.get_by_id(db, invoice.tenant_id)
    customer = None
    if invoice.customer_id is not None:
        customer = await customers_repo.get_by_id(db, invoice.tenant_id, invoice.customer_id)

    pdf_bytes = render_invoice_pdf(invoice, tenant, customer)
    filename = f"{invoice.invoice_number or invoice.draft_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
