import uuid
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
