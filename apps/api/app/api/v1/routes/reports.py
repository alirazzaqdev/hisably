from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, require_permission
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import reports as reports_repo
from app.schemas.reports import (
    BalanceSheetResponse,
    DayBookResponse,
    ProfitLossResponse,
    StockSummaryResponse,
    VatSummary,
)

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


@router.get("/day-book", response_model=DayBookResponse, dependencies=[Depends(require_permission("reports"))])
async def get_day_book(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> DayBookResponse:
    effective_from = date_from or date.today()
    effective_to = date_to or effective_from
    entries, total_in, total_out = await reports_repo.day_book(
        db, tenant.id, date_from=effective_from, date_to=effective_to
    )
    return DayBookResponse(entries=entries, total_in=total_in, total_out=total_out)


@router.get("/stock-summary", response_model=StockSummaryResponse, dependencies=[Depends(require_permission("reports"))])
async def get_stock_summary(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> StockSummaryResponse:
    items, total_value = await reports_repo.stock_summary(db, tenant.id)
    return StockSummaryResponse(items=items, total_stock_value=total_value)


@router.get("/profit-loss", response_model=ProfitLossResponse, dependencies=[Depends(require_permission("reports"))])
async def get_profit_loss(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ProfitLossResponse:
    sales_revenue, sales_returns, cogs, expenses_by_category, total_expenses = await reports_repo.profit_loss(
        db, tenant.id, date_from=date_from, date_to=date_to
    )
    net_revenue = sales_revenue - sales_returns
    gross_profit = net_revenue - cogs
    net_profit = gross_profit - total_expenses
    return ProfitLossResponse(
        sales_revenue=sales_revenue,
        sales_returns=sales_returns,
        net_revenue=net_revenue,
        cost_of_goods_sold=cogs,
        gross_profit=gross_profit,
        expenses_by_category=expenses_by_category,
        total_expenses=total_expenses,
        net_profit=net_profit,
    )


@router.get("/balance-sheet", response_model=BalanceSheetResponse, dependencies=[Depends(require_permission("reports"))])
async def get_balance_sheet(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> BalanceSheetResponse:
    cash_and_bank = await reports_repo.cash_and_bank_balance(db, tenant.id)
    accounts_receivable = await reports_repo.outstanding_receivables(db, tenant.id)
    _, inventory_value = await reports_repo.stock_summary(db, tenant.id)
    accounts_payable = await reports_repo.outstanding_payables(db, tenant.id)

    total_assets = cash_and_bank + accounts_receivable + inventory_value
    total_liabilities = accounts_payable
    equity = total_assets - total_liabilities

    return BalanceSheetResponse(
        cash_and_bank=cash_and_bank,
        accounts_receivable=accounts_receivable,
        inventory_value=inventory_value,
        total_assets=total_assets,
        accounts_payable=accounts_payable,
        total_liabilities=total_liabilities,
        equity=equity,
    )
