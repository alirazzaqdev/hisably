from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import reports as reports_repo
from app.schemas.reports import (
    DashboardKpis,
    ReceivablesAgingBucket,
    SalesTrendPoint,
    TopCustomer,
    TopItem,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/kpis", response_model=DashboardKpis)
async def get_kpis(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> DashboardKpis:
    today = datetime.now(timezone.utc).date()
    return DashboardKpis(
        total_customers=await reports_repo.count_customers(db, tenant.id),
        total_items=await reports_repo.count_items(db, tenant.id),
        total_invoices=await reports_repo.count_invoices(db, tenant.id),
        revenue_paid=await reports_repo.revenue_paid(db, tenant.id),
        outstanding_receivables=await reports_repo.outstanding_receivables(db, tenant.id),
        expenses_this_month=await reports_repo.expenses_this_month(db, tenant.id, today),
        invoices_overdue=await reports_repo.count_overdue_invoices(db, tenant.id, today),
    )


@router.get("/sales-trend", response_model=list[SalesTrendPoint])
async def get_sales_trend(
    months: int = Query(default=6, ge=1, le=24),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[SalesTrendPoint]:
    rows = await reports_repo.sales_trend(db, tenant.id, months=months)
    return [SalesTrendPoint(period=p, invoiced_total=inv, paid_total=paid) for p, inv, paid in rows]


@router.get("/top-customers", response_model=list[TopCustomer])
async def get_top_customers(
    limit: int = Query(default=5, ge=1, le=20),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[TopCustomer]:
    rows = await reports_repo.top_customers(db, tenant.id, limit=limit)
    return [TopCustomer(customer_id=cid, name=name, total_invoiced=inv, total_paid=paid) for cid, name, inv, paid in rows]


@router.get("/top-items", response_model=list[TopItem])
async def get_top_items(
    limit: int = Query(default=5, ge=1, le=20),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[TopItem]:
    rows = await reports_repo.top_items(db, tenant.id, limit=limit)
    return [TopItem(item_id=item_id, description=description, quantity=qty, revenue=rev) for item_id, description, qty, rev in rows]


@router.get("/receivables-aging", response_model=list[ReceivablesAgingBucket])
async def get_receivables_aging(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ReceivablesAgingBucket]:
    today = datetime.now(timezone.utc).date()
    rows = await reports_repo.receivables_aging(db, tenant.id, today)
    return [ReceivablesAgingBucket(label=label, total=total, count=count) for label, total, count in rows]
