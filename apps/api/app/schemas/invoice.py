import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InvoiceLanguage, InvoiceStatus, InvoiceType, PdfTemplate, VatCategory


class InvoiceLineItemInput(BaseModel):
    item_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=500)
    description_ar: str | None = Field(default=None, max_length=500)
    quantity: Decimal | None = None
    width: Decimal | None = None
    height: Decimal | None = None
    unit_price: Decimal = Decimal("0")
    discount_percent: Decimal | None = None
    discount_amount: Decimal | None = None
    vat_category: VatCategory = VatCategory.STANDARD


class InvoiceLineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID | None
    description: str
    description_ar: str | None
    quantity: Decimal
    width: Decimal | None
    height: Decimal | None
    unit_price: Decimal
    discount_percent: Decimal | None
    discount_amount: Decimal | None
    vat_category: VatCategory
    vat_rate: Decimal
    vat_amount: Decimal
    line_total: Decimal


class InvoiceCreate(BaseModel):
    type: InvoiceType = InvoiceType.TAX_INVOICE
    customer_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    issue_date: date
    due_date: date | None = None
    currency: str = Field(default="AED", min_length=3, max_length=3)
    discount_amount: Decimal = Decimal("0")
    notes: str | None = Field(default=None, max_length=2000)
    terms: str | None = Field(default=None, max_length=2000)
    pdf_template: PdfTemplate = PdfTemplate.MINIMAL
    language: InvoiceLanguage = InvoiceLanguage.EN
    line_items: list[InvoiceLineItemInput] = Field(default_factory=list, min_length=1)
    client_uuid: uuid.UUID | None = None


class InvoiceUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    issue_date: date | None = None
    due_date: date | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    discount_amount: Decimal | None = None
    notes: str | None = Field(default=None, max_length=2000)
    terms: str | None = Field(default=None, max_length=2000)
    pdf_template: PdfTemplate | None = None
    language: InvoiceLanguage | None = None
    line_items: list[InvoiceLineItemInput] | None = Field(default=None, min_length=1)


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus
    void_reason: str | None = Field(default=None, max_length=500)


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: InvoiceType
    status: InvoiceStatus
    customer_id: uuid.UUID | None
    supplier_id: uuid.UUID | None
    invoice_number: str | None
    draft_number: str
    issue_date: date
    due_date: date | None
    currency: str
    discount_amount: Decimal = Decimal("0")
    subtotal: Decimal
    discount_total: Decimal
    vat_total: Decimal
    grand_total: Decimal
    notes: str | None
    terms: str | None
    pdf_template: PdfTemplate
    language: InvoiceLanguage
    void_reason: str | None
    line_items: list[InvoiceLineItemOut] = Field(default_factory=list)
