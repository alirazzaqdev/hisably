from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, require_permission
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import reports as reports_repo
from app.schemas.reports import VatSummary

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/vat-summary", response_model=VatSummary, dependencies=[Depends(require_permission("reports"))])
async def get_vat_summary(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> VatSummary:
    output_vat, input_vat = await reports_repo.vat_summary(db, tenant.id, date_from=date_from, date_to=date_to)
    return VatSummary(output_vat=output_vat, input_vat=input_vat, net_vat_due=output_vat - input_vat)
