import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    name_ar: str | None = Field(default=None, max_length=255)
    trn: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    billing_address: str | None = Field(default=None, max_length=500)
    opening_balance: Decimal = Decimal("0")
    client_uuid: uuid.UUID | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    name_ar: str | None = Field(default=None, max_length=255)
    trn: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    billing_address: str | None = Field(default=None, max_length=500)
    opening_balance: Decimal | None = None


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    name_ar: str | None
    trn: str | None
    phone: str | None
    email: str | None
    billing_address: str | None
    opening_balance: Decimal
