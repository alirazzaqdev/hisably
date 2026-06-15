import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.catalog.industry_profiles import resolve_enabled_fields
from app.models.enums import Country, VatCategory


class OnboardingBusinessRequest(BaseModel):
    business_name: str = Field(min_length=1, max_length=255)
    country: Country = Country.AE
    trn: str | None = Field(default=None, max_length=32)
    vat_registered: bool = False
    logo_url: str | None = None
    invoice_prefix: str = Field(default="INV-", max_length=16)
    invoice_starting_number: int = Field(default=1, ge=1)


class TenantUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=1, max_length=255)
    trn: str | None = Field(default=None, max_length=32)
    vat_registered: bool | None = None
    address: str | None = Field(default=None, max_length=500)
    logo_url: str | None = None
    invoice_prefix: str | None = Field(default=None, max_length=16)
    quotation_prefix: str | None = Field(default=None, max_length=16)
    default_vat_category: VatCategory | None = None
    industry_profile: str | None = Field(default=None, max_length=32)
    enabled_fields: dict[str, bool] | None = None
    field_labels: dict[str, str] | None = None
    cheque_payee_name: str | None = Field(default=None, max_length=255)
    bank_name: str | None = Field(default=None, max_length=255)
    bank_account_number: str | None = Field(default=None, max_length=64)
    bank_iban: str | None = Field(default=None, max_length=64)
    contact_person: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=32)
    stamp_url: str | None = Field(default=None, max_length=500)
    signature_url: str | None = Field(default=None, max_length=500)
    branding_options: dict[str, dict[str, bool]] | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_name: str
    country: Country
    currency: str
    vat_registered: bool
    trn: str | None
    address: str | None
    logo_url: str | None
    invoice_prefix: str
    quotation_prefix: str
    default_vat_category: VatCategory
    industry_profile: str
    enabled_fields: dict[str, bool]
    field_labels: dict[str, str]
    cheque_payee_name: str | None
    bank_name: str | None
    bank_account_number: str | None
    bank_iban: str | None
    contact_person: str | None
    contact_phone: str | None
    stamp_url: str | None
    signature_url: str | None
    branding_options: dict[str, dict[str, bool]]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def resolved_fields(self) -> dict[str, bool]:
        return resolve_enabled_fields(self.industry_profile, self.enabled_fields)
