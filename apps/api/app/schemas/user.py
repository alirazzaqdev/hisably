import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    permissions: dict[str, bool]
    email_verified: bool

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            role=user.role,
            permissions=user.permissions or {},
            email_verified=user.email_verified_at is not None,
        )


class StaffCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    permissions: dict[str, bool] = Field(default_factory=dict)


class StaffUpdate(BaseModel):
    permissions: dict[str, bool] | None = None
