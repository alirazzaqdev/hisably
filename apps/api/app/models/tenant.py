from sqlalchemy import Boolean, Enum, String
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
    default_vat_category: Mapped[VatCategory] = mapped_column(
        Enum(VatCategory, native_enum=False), default=VatCategory.STANDARD
    )
