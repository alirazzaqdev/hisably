from sqlalchemy import Boolean, Enum, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import Country, VatCategory


class Tenant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tenants"

    business_name: Mapped[str] = mapped_column(String(255))
    trn: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vat_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    country: Mapped[Country] = mapped_column(Enum(Country, native_enum=False), default=Country.AE)
    currency: Mapped[str] = mapped_column(String(3), default="AED")
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    invoice_prefix: Mapped[str] = mapped_column(String(16), default="INV-")
    quotation_prefix: Mapped[str] = mapped_column(String(16), default="QUO-")
    default_vat_category: Mapped[VatCategory] = mapped_column(
        Enum(VatCategory, native_enum=False), default=VatCategory.STANDARD
    )

    # Industry preset key (e.g. "general", "glass_aluminium"). Drives default
    # optional-field visibility via app.catalog.industry_profiles.
    industry_profile: Mapped[str] = mapped_column(String(32), default="general")
    # Per-tenant overrides on top of the preset defaults, e.g. {"header.lpo_no": true}.
    enabled_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    # Per-tenant label overrides for catalog fields, e.g. {"header.lpo_no": "PO Number"}.
    field_labels: Mapped[dict] = mapped_column(JSON, default=dict)

    # Banking & contact details, printed on Proforma/Tax Invoice footers when set.
    cheque_payee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bank_iban: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Stamp/signature images, printed on invoice footers when enabled per doc type.
    stamp_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signature_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Per-doc-type footer toggles, e.g. {"tax_invoice": {"show_stamp": true, "show_signature": false}}.
    branding_options: Mapped[dict] = mapped_column(JSON, default=dict)
