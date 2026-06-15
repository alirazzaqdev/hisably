import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ChequeStatus, PaymentMethod


class PaymentAllocationInput(BaseModel):
    invoice_id: uuid.UUID
    amount: Decimal = Field(gt=0)


class PaymentAllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    amount_allocated: Decimal


class PaymentCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0)
    method: PaymentMethod = PaymentMethod.CASH
    reference_no: str | None = Field(default=None, max_length=100)
    payment_date: date
    notes: str | None = Field(default=None, max_length=1000)
    cheque_number: str | None = Field(default=None, max_length=50)
    cheque_date: date | None = None
    allocations: list[PaymentAllocationInput] = Field(default_factory=list)
    client_uuid: uuid.UUID | None = None


class ChequeStatusUpdate(BaseModel):
    cheque_status: ChequeStatus


class PaymentUpdate(BaseModel):
    account_id: uuid.UUID | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    method: PaymentMethod | None = None
    reference_no: str | None = Field(default=None, max_length=100)
    payment_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)
    cheque_number: str | None = Field(default=None, max_length=50)
    cheque_date: date | None = None


class PaymentVoidRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID | None
    supplier_id: uuid.UUID | None
    account_id: uuid.UUID | None
    amount: Decimal
    method: PaymentMethod
    reference_no: str | None
    payment_date: date
    notes: str | None
    cheque_number: str | None
    cheque_date: date | None
    cheque_status: ChequeStatus | None
    voided_at: datetime | None
    void_reason: str | None
    allocations: list[PaymentAllocationOut] = Field(default_factory=list)


class ReceivableOut(BaseModel):
    invoice_id: uuid.UUID
    invoice_number: str | None
    draft_number: str
    customer_id: uuid.UUID | None
    issue_date: date
    due_date: date | None
    currency: str
    grand_total: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    status: str
