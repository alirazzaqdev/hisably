import csv
import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.account import Account
from app.models.tenant import Tenant
from app.repositories import accounts as accounts_repo
from app.schemas.account import (
    AccountCreate,
    AccountOut,
    AccountStatementOut,
    AccountTransferCreate,
    AccountTransferOut,
    AccountUpdate,
)
from app.services.account_statement_pdf import render_account_statement_pdf

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


@router.get("/{account_id}/statement", response_model=AccountStatementOut)
async def get_account_statement(
    account_id: uuid.UUID,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AccountStatementOut:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    opening_balance, entries, closing_balance = await accounts_repo.get_statement(db, tenant.id, account, date_from, date_to)
    return AccountStatementOut(
        account_id=account.id,
        account_name=account.name,
        date_from=date_from,
        date_to=date_to,
        opening_balance=opening_balance,
        closing_balance=closing_balance,
        entries=entries,
    )


@router.get("/{account_id}/statement/pdf")
async def get_account_statement_pdf(
    account_id: uuid.UUID,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Response:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    opening_balance, entries, closing_balance = await accounts_repo.get_statement(db, tenant.id, account, date_from, date_to)
    pdf_bytes = render_account_statement_pdf(tenant, account, opening_balance, entries, closing_balance, date_from, date_to)
    filename = f"{account.name.replace(' ', '_')}_statement.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{account_id}/statement/csv")
async def get_account_statement_csv(
    account_id: uuid.UUID,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Response:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    opening_balance, entries, closing_balance = await accounts_repo.get_statement(db, tenant.id, account, date_from, date_to)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", f"In ({tenant.currency})", f"Out ({tenant.currency})", f"Balance ({tenant.currency})"])
    writer.writerow(["", "Opening balance", "", "", f"{opening_balance:.2f}"])
    for entry in entries:
        writer.writerow(
            [
                entry.date.isoformat(),
                entry.description,
                f"{entry.amount_in:.2f}" if entry.amount_in else "",
                f"{entry.amount_out:.2f}" if entry.amount_out else "",
                f"{entry.balance:.2f}",
            ]
        )
    writer.writerow(["", "Closing balance", "", "", f"{closing_balance:.2f}"])

    filename = f"{account.name.replace(' ', '_')}_statement.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: uuid.UUID,
    force: bool = False,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    account = await accounts_repo.get_by_id(db, tenant.id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if not force and await accounts_repo.has_linked_records(db, tenant.id, account_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account has linked payments, expenses, or transfers. Pass ?force=true to delete anyway.",
        )
    await accounts_repo.delete(db, account)
    await db.commit()
