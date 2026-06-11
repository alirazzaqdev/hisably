import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Country
from app.schemas.auth import TokenResponse


class FirmCreate(BaseModel):
    business_name: str = Field(min_length=1, max_length=255)
    country: Country = Country.AE


class FirmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_name: str
    country: Country
    currency: str
    is_active: bool


class FirmSwitchResponse(TokenResponse):
    pass
