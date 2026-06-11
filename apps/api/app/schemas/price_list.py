import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PriceListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class PriceListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class PriceListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ItemPriceInput(BaseModel):
    price_list_id: uuid.UUID
    price: Decimal


class ItemPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    price_list_id: uuid.UUID
    price: Decimal


class PriceListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: uuid.UUID
    price: Decimal
