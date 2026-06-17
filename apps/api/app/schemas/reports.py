import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    total_customers: int
    total_items: int
    total_invoices: int
    revenue_paid: Decimal
    outstanding_receivables: Decimal
    expenses_this_month: Decimal
    invoices_overdue: int
    date_from: date | None = None
    date_to: date | None = None


class SalesTrendPoint(BaseModel):
    period: str
    invoiced_total: Decimal
    paid_total: Decimal


class TopCustomer(BaseModel):
    customer_id: uuid.UUID
    name: str
    total_invoiced: Decimal
    total_paid: Decimal


class TopItem(BaseModel):
    item_id: uuid.UUID | None
    description: str
    quantity: Decimal
    revenue: Decimal


class ReceivablesAgingBucket(BaseModel):
    label: str
    total: Decimal
    count: int


class VatSummary(BaseModel):
    output_vat: Decimal
    input_vat: Decimal
    net_vat_due: Decimal


class DayBookEntry(BaseModel):
    id: uuid.UUID
    entry_date: date
    type: str
    reference: str
    party_name: str | None
    amount: Decimal
    direction: str


class DayBookResponse(BaseModel):
    entries: list[DayBookEntry]
    total_in: Decimal
    total_out: Decimal


class StockSummaryItem(BaseModel):
    item_id: uuid.UUID
    name: str
    sku: str | None
    unit: str
    current_stock: Decimal
    purchase_price: Decimal
    stock_value: Decimal


class StockSummaryResponse(BaseModel):
    items: list[StockSummaryItem]
    total_stock_value: Decimal


class ExpenseCategoryTotal(BaseModel):
    category: str
    amount: Decimal


class ProfitLossResponse(BaseModel):
    sales_revenue: Decimal
    sales_returns: Decimal
    net_revenue: Decimal
    cost_of_goods_sold: Decimal
    gross_profit: Decimal
    expenses_by_category: list[ExpenseCategoryTotal]
    total_expenses: Decimal
    net_profit: Decimal


class BalanceSheetResponse(BaseModel):
    cash_and_bank: Decimal
    accounts_receivable: Decimal
    inventory_value: Decimal
    total_assets: Decimal
    accounts_payable: Decimal
    total_liabilities: Decimal
    equity: Decimal
    liabilities_and_equity: Decimal
