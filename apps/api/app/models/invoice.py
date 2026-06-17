import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import InvoiceLanguage, InvoiceStatus, InvoiceType, PdfTemplate, QuotationStatus, VatCategory


class InvoiceNumberSequence(Base, UUIDPrimaryKeyMixin, TenantScopedMixin):
    __tablename__ = "invoice_number_sequences"
    __table_args__ = (UniqueConstraint("tenant_id", "invoice_type", name="uq_sequence_tenant_type"),)

    invoice_type: Mapped[InvoiceType] = mapped_column(Enum(InvoiceType, native_enum=False))
    next_number: Mapped[int] = mapped_column(BigInteger, default=1)


class Invoice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "invoices"

    type: Mapped[InvoiceType] = mapped_column(Enum(InvoiceType, native_enum=False))
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, native_enum=False), default=InvoiceStatus.DRAFT
    )

    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)

    invoice_number: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    draft_number: Mapped[str] = mapped_column(String(32))
    client_uuid: Mapped[uuid.UUID] = mapped_column(unique=True)

    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    currency: Mapped[str] = mapped_column(String(3), default="AED")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), default=1)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    vat_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    terms: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    site_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    site_image_after_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_photos: Mapped[list] = mapped_column(JSON, default=list)
    after_photos: Mapped[list] = mapped_column(JSON, default=list)

    pdf_template: Mapped[PdfTemplate] = mapped_column(
        Enum(PdfTemplate, native_enum=False), default=PdfTemplate.MINIMAL
    )
    accent_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    language: Mapped[InvoiceLanguage] = mapped_column(
        Enum(InvoiceLanguage, native_enum=False), default=InvoiceLanguage.EN
    )
    language_secondary: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)
    vat_rate_override: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True, default=None)

    lpo_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    project_villa_no: Mapped[str | None] = mapped_column(String(128), nullable=True)
    bill_to_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ship_to_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    converted_from_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    public_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)

    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    void_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    quotation_status: Mapped[QuotationStatus | None] = mapped_column(
        Enum(QuotationStatus, native_enum=False), nullable=True
    )
    expiry_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_soon_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class InvoiceLineItem(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "invoice_line_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("items.id"), nullable=True)

    description: Mapped[str] = mapped_column(String(500))
    description_ar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(16), nullable=True, default="pcs")

    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    width_mm: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    height_mm: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    length_mm: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)

    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    computed_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    override_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    final_payment_factor: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    vat_category: Mapped[VatCategory] = mapped_column(Enum(VatCategory, native_enum=False))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
