import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreate(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)
    vat_paid: Decimal = Decimal("0")
    supplier_id: uuid.UUID | None = None
    expense_date: date
    notes: str | None = Field(default=None, max_length=1000)
    attachment_id: uuid.UUID | None = None
    client_uuid: uuid.UUID | None = None


class ExpenseUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=100)
    amount: Decimal | None = Field(default=None, gt=0)
    vat_paid: Decimal | None = None
    supplier_id: uuid.UUID | None = None
    expense_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)
    attachment_id: uuid.UUID | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: str
    amount: Decimal
    vat_paid: Decimal
    supplier_id: uuid.UUID | None
    expense_date: date
    notes: str | None
    attachment_id: uuid.UUID | None
    attachment_url: str | None = None
