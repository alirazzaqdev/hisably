from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.schemas.tenant import OnboardingBusinessRequest, TenantOut
from app.services import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/business", response_model=TenantOut)
async def update_business(
    payload: OnboardingBusinessRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> TenantOut:
    tenant = await onboarding_service.update_business(db, tenant, payload)
    return TenantOut.model_validate(tenant)
