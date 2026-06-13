import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import JobPaymentStatus, JobTaxInvoiceStatus, JobWorkStatus


class JobRegisterRow(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "job_register_rows"

    qt_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    lpo_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    villa_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(String(500))

    rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    vat: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    override_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    company_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    work_status: Mapped[JobWorkStatus] = mapped_column(
        Enum(JobWorkStatus, native_enum=False), default=JobWorkStatus.NOT_COMPLETED
    )
    tax_invoice_status: Mapped[JobTaxInvoiceStatus] = mapped_column(
        Enum(JobTaxInvoiceStatus, native_enum=False), default=JobTaxInvoiceStatus.NOT_SUBMITTED
    )
    payment_status: Mapped[JobPaymentStatus] = mapped_column(
        Enum(JobPaymentStatus, native_enum=False), default=JobPaymentStatus.PENDING
    )

    remarks: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    client_uuid: Mapped[uuid.UUID] = mapped_column(unique=True)


class JobReceipt(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "job_receipts"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    company_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    receipt_date: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    linked_payment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("payments.id"), nullable=True)

    client_uuid: Mapped[uuid.UUID] = mapped_column(unique=True)
