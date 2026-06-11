import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ItemUnit, VatCategory


class Item(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "items"

    name: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(64), nullable=True)
    unit: Mapped[ItemUnit] = mapped_column(Enum(ItemUnit, native_enum=False), default=ItemUnit.PCS)
    is_area_based: Mapped[bool] = mapped_column(Boolean, default=False)

    sale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    vat_category: Mapped[VatCategory] = mapped_column(
        Enum(VatCategory, native_enum=False), default=VatCategory.STANDARD
    )

    track_inventory: Mapped[bool] = mapped_column(Boolean, default=False)
    current_stock: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    low_stock_threshold: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)

    client_uuid: Mapped[uuid.UUID | None] = mapped_column(nullable=True, unique=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("item_categories.id", ondelete="SET NULL"), nullable=True
    )
