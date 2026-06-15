import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.account import Account
from app.models.tenant import Tenant
from app.repositories import accounts as accounts_repo
from app.schemas.account import AccountCreate, AccountOut, AccountTransferCreate, AccountTransferOut, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _to_out(db: AsyncSession, tenant_id: uuid.UUID, account: Account) -> AccountOut:
    out = AccountOut.model_validate(account)
    out.current_balance = await accounts_repo.get_balance(db, tenant_id, account)
    return out


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[AccountOut]:
    accounts = await accounts_repo.list_all(db, tenant.id)
    return [await _to_out(db, tenant.id, account) for account in accounts]


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AccountOut:
    account = await accounts_repo.create(db, tenant.id, payload)
    await db.commit()
    return await _to_out(db, tenant.id, account)


@router.get("/transfers", response_model=list[AccountTransferOut])
async def list_transfers(
    account_id: uuid.UUID | None = None,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[AccountTransferOut]:
    transfers = await accounts_repo.list_transfers(db, tenant.id, account_id)
    return [AccountTransferOut.model_validate(t) for t in transfers]


@router.post("/transfers", response_model=AccountTransferOut, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    payload: AccountTransferCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AccountTransferOut:
    try:
        transfer = await accounts_repo.create_transfer(db, tenant.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    await db.commit()
    return AccountTransferOut.model_validate(transfer)


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AccountOut:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return await _to_out(db, tenant.id, account)


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AccountOut:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    account = await accounts_repo.update(db, account, payload)
    await db.commit()
    return await _to_out(db, tenant.id, account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    await accounts_repo.delete(db, account)
    await db.commit()
