import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import customers as customers_repo
from app.repositories import ledger as ledger_repo
from app.schemas.common import Page
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.schemas.ledger import PartyStatement

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=Page[CustomerOut])
async def list_customers(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[CustomerOut]:
    items, total = await customers_repo.list_paginated(
        db, tenant.id, search=search, page=page, page_size=page_size
    )
    return Page(items=[CustomerOut.model_validate(c) for c in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> CustomerOut:
    customer = await customers_repo.create(db, tenant.id, payload)
    await db.commit()
    return CustomerOut.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> CustomerOut:
    customer = await customers_repo.get_by_id(db, tenant.id, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return CustomerOut.model_validate(customer)


@router.get("/{customer_id}/statement", response_model=PartyStatement)
async def get_customer_statement(
    customer_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PartyStatement:
    customer = await customers_repo.get_by_id(db, tenant.id, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return await ledger_repo.customer_statement(db, tenant.id, customer)


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> CustomerOut:
    customer = await customers_repo.get_by_id(db, tenant.id, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    customer = await customers_repo.update(db, customer, payload)
    await db.commit()
    return CustomerOut.model_validate(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    customer = await customers_repo.get_by_id(db, tenant.id, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    await customers_repo.delete(db, customer)
    await db.commit()
