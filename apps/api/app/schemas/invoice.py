import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InvoiceLanguage, InvoiceStatus, InvoiceType, PdfTemplate, QuotationStatus, VatCategory


class InvoiceLineItemInput(BaseModel):
    item_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=500)
    description_ar: str | None = Field(default=None, max_length=500)
    quantity: Decimal | None = None
    width_mm: Decimal | None = None
    height_mm: Decimal | None = None
    length_mm: Decimal | None = None
    unit_price: Decimal = Decimal("0")
    discount_percent: Decimal | None = None
    discount_amount: Decimal | None = None
    override_total: Decimal | None = None
    final_payment_factor: Decimal | None = None
    vat_category: VatCategory = VatCategory.STANDARD


class InvoiceLineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID | None
    description: str
    description_ar: str | None
    quantity: Decimal
    width_mm: Decimal | None
    height_mm: Decimal | None
    length_mm: Decimal | None
    unit_price: Decimal
    discount_percent: Decimal | None
    discount_amount: Decimal | None
    computed_total: Decimal | None
    override_total: Decimal | None
    final_payment_factor: Decimal | None
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
    exchange_rate: Decimal = Field(default=Decimal("1"), gt=0)
    discount_amount: Decimal = Decimal("0")
    notes: str | None = Field(default=None, max_length=2000)
    terms: str | None = Field(default=None, max_length=2000)
    pdf_template: PdfTemplate = PdfTemplate.MINIMAL
    accent_color: str | None = Field(default=None, max_length=16)
    language: InvoiceLanguage = InvoiceLanguage.EN
    lpo_no: str | None = Field(default=None, max_length=64)
    project_villa_no: str | None = Field(default=None, max_length=128)
    bill_to_address: str | None = Field(default=None, max_length=500)
    ship_to_address: str | None = Field(default=None, max_length=500)
    site_image_url: str | None = Field(default=None, max_length=500)
    line_items: list[InvoiceLineItemInput] = Field(default_factory=list, min_length=1)
    client_uuid: uuid.UUID | None = None
    converted_from_id: uuid.UUID | None = None


class InvoiceUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    issue_date: date | None = None
    due_date: date | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    exchange_rate: Decimal | None = Field(default=None, gt=0)
    discount_amount: Decimal | None = None
    notes: str | None = Field(default=None, max_length=2000)
    terms: str | None = Field(default=None, max_length=2000)
    pdf_template: PdfTemplate | None = None
    accent_color: str | None = Field(default=None, max_length=16)
    language: InvoiceLanguage | None = None
    lpo_no: str | None = Field(default=None, max_length=64)
    project_villa_no: str | None = Field(default=None, max_length=128)
    bill_to_address: str | None = Field(default=None, max_length=500)
    ship_to_address: str | None = Field(default=None, max_length=500)
    site_image_url: str | None = Field(default=None, max_length=500)
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
    exchange_rate: Decimal
    discount_amount: Decimal = Decimal("0")
    subtotal: Decimal
    discount_total: Decimal
    vat_total: Decimal
    grand_total: Decimal
    notes: str | None
    terms: str | None
    pdf_template: PdfTemplate
    accent_color: str | None
    language: InvoiceLanguage
    lpo_no: str | None
    project_villa_no: str | None
    bill_to_address: str | None
    ship_to_address: str | None
    site_image_url: str | None
    void_reason: str | None
    converted_from_id: uuid.UUID | None
    public_token: str | None
    quotation_status: QuotationStatus | None = None
    effective_quotation_status: QuotationStatus | None = None
    line_items: list[InvoiceLineItemOut] = Field(default_factory=list)


class QuotationStatusUpdate(BaseModel):
    status: QuotationStatus
    due_date: date | None = None


class QuotationCounts(BaseModel):
    draft: int
    pending: int
    approved: int
    rejected: int
    expired: int
    total: int
