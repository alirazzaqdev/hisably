import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Country


class OnboardingBusinessRequest(BaseModel):
    business_name: str = Field(min_length=1, max_length=255)
    country: Country = Country.AE
    trn: str | None = Field(default=None, max_length=32)
    vat_registered: bool = False
    logo_url: str | None = None
    invoice_prefix: str = Field(default="INV-", max_length=16)
    invoice_starting_number: int = Field(default=1, ge=1)


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_name: str
    country: Country
    currency: str
    vat_registered: bool
    trn: str | None
    logo_url: str | None
    invoice_prefix: str
