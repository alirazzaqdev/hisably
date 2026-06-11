import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.tenant import Tenant
from app.models.user import User
from app.repositories import firm_memberships as firm_memberships_repo
from app.repositories import tenants as tenants_repo
from app.repositories import users as users_repo

bearer_scheme = HTTPBearer(auto_error=False)


async def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    return payload


async def get_current_user(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await users_repo.get_by_id(db, uuid.UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_current_tenant(
    payload: dict = Depends(get_token_payload),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tenant:
    tenant_id_raw = payload.get("tenant_id")
    tenant_id = uuid.UUID(tenant_id_raw) if tenant_id_raw else user.tenant_id

    if tenant_id != user.tenant_id:
        if not await firm_memberships_repo.exists(db, user.id, tenant_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this firm")

    tenant = await tenants_repo.get_by_id(db, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


async def require_owner(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the business owner can do this")
    return user


def require_permission(module: str):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role == UserRole.OWNER:
            return user
        if not user.permissions.get(module, False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this section")
        return user

    return _check
