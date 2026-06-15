from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.enums import AccountType
from app.models.tenant import Tenant
from app.repositories import invoice_sequences as invoice_sequences_repo
from app.schemas.tenant import OnboardingBusinessRequest
from app.tax.countries import get_country_info


async def update_business(db: AsyncSession, tenant: Tenant, payload: OnboardingBusinessRequest) -> Tenant:
    tenant.business_name = payload.business_name
    tenant.country = payload.country
    country_info = get_country_info(payload.country.value)
    if country_info is not None:
        tenant.currency = country_info.currency
        tenant.vat_rate = Decimal(str(country_info.vat_rate))
    tenant.trn = payload.trn
    tenant.vat_registered = payload.vat_registered
    tenant.logo_url = payload.logo_url
    tenant.invoice_prefix = payload.invoice_prefix

    await invoice_sequences_repo.create_default_sequences(db, tenant.id, payload.invoice_starting_number)

    existing_account = (
        await db.execute(select(Account).where(Account.tenant_id == tenant.id))
    ).scalar_one_or_none()
    if existing_account is None:
        db.add(Account(tenant_id=tenant.id, name="Cash", type=AccountType.CASH))
        db.add(Account(tenant_id=tenant.id, name="Bank", type=AccountType.BANK))

    await db.commit()
    await db.refresh(tenant)
    return tenant
