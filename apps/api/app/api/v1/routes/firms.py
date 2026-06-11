import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_token_payload, require_owner
from app.db.session import get_db
from app.models.user import User
from app.repositories import firm_memberships as firm_memberships_repo
from app.repositories import tenants as tenants_repo
from app.schemas.firm import FirmCreate, FirmOut, FirmSwitchResponse
from app.services.auth_service import issue_token_pair

router = APIRouter(prefix="/firms", tags=["firms"])


@router.get("", response_model=list[FirmOut])
async def list_firms(
    payload: dict = Depends(get_token_payload),
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> list[FirmOut]:
    member_tenant_ids = await firm_memberships_repo.list_tenant_ids(db, owner.id)
    tenant_ids = {owner.tenant_id, *member_tenant_ids}
    tenants = await tenants_repo.get_many_by_ids(db, list(tenant_ids))

    active_tenant_id = payload.get("tenant_id") or str(owner.tenant_id)
    return [
        FirmOut(
            id=tenant.id,
            business_name=tenant.business_name,
            country=tenant.country,
            currency=tenant.currency,
            is_active=str(tenant.id) == str(active_tenant_id),
        )
        for tenant in tenants
    ]


@router.post("", response_model=FirmOut, status_code=status.HTTP_201_CREATED)
async def create_firm(
    payload: FirmCreate,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> FirmOut:
    tenant = await tenants_repo.create(db, business_name=payload.business_name, country=payload.country)
    await firm_memberships_repo.create(db, owner.id, tenant.id)
    await db.commit()
    return FirmOut(
        id=tenant.id,
        business_name=tenant.business_name,
        country=tenant.country,
        currency=tenant.currency,
        is_active=False,
    )


@router.post("/{firm_id}/switch", response_model=FirmSwitchResponse)
async def switch_firm(
    firm_id: str,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> FirmSwitchResponse:
    tenant_id = uuid.UUID(firm_id)
    if tenant_id != owner.tenant_id and not await firm_memberships_repo.exists(db, owner.id, tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this firm")

    tenant = await tenants_repo.get_by_id(db, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Firm not found")

    tokens = await issue_token_pair(db, owner, tenant_id=tenant.id)
    return FirmSwitchResponse(access_token=tokens.access_token, refresh_token=tokens.refresh_token)
