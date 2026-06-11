import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ItemUnit, VatCategory


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    name_ar: str | None = Field(default=None, max_length=255)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    unit: ItemUnit = ItemUnit.PCS
    is_area_based: bool = False
    sale_price: Decimal = Decimal("0")
    purchase_price: Decimal = Decimal("0")
    vat_category: VatCategory = VatCategory.STANDARD
    track_inventory: bool = False
    current_stock: Decimal | None = None
    low_stock_threshold: Decimal | None = None
    category_id: uuid.UUID | None = None
    client_uuid: uuid.UUID | None = None


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    name_ar: str | None = Field(default=None, max_length=255)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    unit: ItemUnit | None = None
    is_area_based: bool | None = None
    sale_price: Decimal | None = None
    purchase_price: Decimal | None = None
    vat_category: VatCategory | None = None
    track_inventory: bool | None = None
    current_stock: Decimal | None = None
    low_stock_threshold: Decimal | None = None
    category_id: uuid.UUID | None = None


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    name_ar: str | None
    sku: str | None
    barcode: str | None
    unit: ItemUnit
    is_area_based: bool
    sale_price: Decimal
    purchase_price: Decimal
    vat_category: VatCategory
    track_inventory: bool
    current_stock: Decimal | None
    low_stock_threshold: Decimal | None
    category_id: uuid.UUID | None
