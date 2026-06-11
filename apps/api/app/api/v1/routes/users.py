import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user, require_owner
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.tenant import Tenant
from app.models.user import User
from app.repositories import users as users_repo
from app.schemas.user import StaffCreate, StaffUpdate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.from_user(user)


@router.get("", response_model=list[UserOut])
async def list_users(
    tenant: Tenant = Depends(get_current_tenant),
    _owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> list[UserOut]:
    users = await users_repo.list_by_tenant(db, tenant.id)
    return [UserOut.from_user(u) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: StaffCreate,
    tenant: Tenant = Depends(get_current_tenant),
    _owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    existing = await users_repo.get_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = await users_repo.create_staff(db, tenant.id, payload)
    await db.commit()
    return UserOut.from_user(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_staff(
    user_id: uuid.UUID,
    payload: StaffUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    _owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    user = await users_repo.get_by_id_in_tenant(db, tenant.id, user_id)
    if user is None or user.role != UserRole.STAFF:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    user = await users_repo.update_permissions(db, user, payload)
    await db.commit()
    return UserOut.from_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    user_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    _owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await users_repo.get_by_id_in_tenant(db, tenant.id, user_id)
    if user is None or user.role != UserRole.STAFF:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    await users_repo.delete(db, user)
    await db.commit()
