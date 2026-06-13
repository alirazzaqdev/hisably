import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.enums import JobPaymentStatus, JobTaxInvoiceStatus, JobWorkStatus


class JobRegisterRowCreate(BaseModel):
    qt_no: str | None = Field(default=None, max_length=100)
    quotation_id: uuid.UUID | None = None
    lpo_no: str | None = Field(default=None, max_length=100)
    villa_no: str | None = Field(default=None, max_length=100)
    description: str = Field(min_length=1, max_length=500)
    rate: Decimal = Decimal("0")
    override_total: Decimal | None = None
    customer_id: uuid.UUID | None = None
    company_text: str | None = Field(default=None, max_length=255)
    work_status: JobWorkStatus = JobWorkStatus.NOT_COMPLETED
    tax_invoice_status: JobTaxInvoiceStatus = JobTaxInvoiceStatus.NOT_SUBMITTED
    payment_status: JobPaymentStatus = JobPaymentStatus.PENDING
    remarks: str | None = Field(default=None, max_length=1000)
    source_invoice_id: uuid.UUID | None = None
    sort_order: int = 0
    client_uuid: uuid.UUID | None = None


class JobRegisterRowUpdate(BaseModel):
    qt_no: str | None = Field(default=None, max_length=100)
    quotation_id: uuid.UUID | None = None
    lpo_no: str | None = Field(default=None, max_length=100)
    villa_no: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, min_length=1, max_length=500)
    rate: Decimal | None = None
    override_total: Decimal | None = None
    clear_override_total: bool = False
    customer_id: uuid.UUID | None = None
    company_text: str | None = Field(default=None, max_length=255)
    work_status: JobWorkStatus | None = None
    tax_invoice_status: JobTaxInvoiceStatus | None = None
    payment_status: JobPaymentStatus | None = None
    remarks: str | None = Field(default=None, max_length=1000)
    source_invoice_id: uuid.UUID | None = None
    sort_order: int | None = None


class JobRegisterRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    qt_no: str | None
    quotation_id: uuid.UUID | None
    lpo_no: str | None
    villa_no: str | None
    description: str
    rate: Decimal
    vat: Decimal
    override_total: Decimal | None
    customer_id: uuid.UUID | None
    company_text: str | None
    work_status: JobWorkStatus
    tax_invoice_status: JobTaxInvoiceStatus
    payment_status: JobPaymentStatus
    remarks: str | None
    source_invoice_id: uuid.UUID | None
    sort_order: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total(self) -> Decimal:
        return self.override_total if self.override_total is not None else self.rate + self.vat


class JobReceiptCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    company_text: str | None = Field(default=None, max_length=255)
    amount: Decimal = Field(gt=0)
    receipt_date: date
    note: str | None = Field(default=None, max_length=1000)
    linked_payment_id: uuid.UUID | None = None
    client_uuid: uuid.UUID | None = None


class JobReceiptUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    company_text: str | None = Field(default=None, max_length=255)
    amount: Decimal | None = Field(default=None, gt=0)
    receipt_date: date | None = None
    note: str | None = Field(default=None, max_length=1000)
    linked_payment_id: uuid.UUID | None = None


class JobReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID | None
    company_text: str | None
    amount: Decimal
    receipt_date: date
    note: str | None
    linked_payment_id: uuid.UUID | None


class JobRegisterSummary(BaseModel):
    total_work_value: Decimal
    total_submitted: Decimal
    total_received: Decimal
    total_received_by_status: Decimal
    balance: Decimal
