import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RecurrenceFrequency, VatCategory


class RecurringInvoiceLineItem(BaseModel):
    item_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    vat_category: VatCategory = VatCategory.STANDARD


class RecurringInvoiceCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    frequency: RecurrenceFrequency
    start_date: date
    end_date: date | None = None
    currency: str = Field(default="AED", min_length=3, max_length=3)
    discount_amount: Decimal = Decimal("0")
    notes: str | None = Field(default=None, max_length=2000)
    terms: str | None = Field(default=None, max_length=2000)
    line_items: list[RecurringInvoiceLineItem] = Field(min_length=1)


class RecurringInvoiceUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    frequency: RecurrenceFrequency | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    discount_amount: Decimal | None = None
    notes: str | None = Field(default=None, max_length=2000)
    terms: str | None = Field(default=None, max_length=2000)
    line_items: list[RecurringInvoiceLineItem] | None = Field(default=None, min_length=1)


class RecurringInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID | None
    frequency: RecurrenceFrequency
    start_date: date
    next_run_date: date
    end_date: date | None
    is_active: bool
    currency: str
    discount_amount: Decimal
    notes: str | None
    terms: str | None
    line_items: list[RecurringInvoiceLineItem]
    last_generated_invoice_id: uuid.UUID | None
