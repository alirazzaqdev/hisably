import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import ledger as ledger_repo
from app.repositories import suppliers as suppliers_repo
from app.schemas.common import Page
from app.schemas.ledger import PartyStatement
from app.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("", response_model=Page[SupplierOut])
async def list_suppliers(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[SupplierOut]:
    items, total = await suppliers_repo.list_paginated(
        db, tenant.id, search=search, page=page, page_size=page_size
    )
    return Page(items=[SupplierOut.model_validate(s) for s in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SupplierOut:
    supplier = await suppliers_repo.create(db, tenant.id, payload)
    await db.commit()
    return SupplierOut.model_validate(supplier)


@router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(
    supplier_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SupplierOut:
    supplier = await suppliers_repo.get_by_id(db, tenant.id, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return SupplierOut.model_validate(supplier)


@router.get("/{supplier_id}/statement", response_model=PartyStatement)
async def get_supplier_statement(
    supplier_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PartyStatement:
    supplier = await suppliers_repo.get_by_id(db, tenant.id, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return await ledger_repo.supplier_statement(db, tenant.id, supplier)


@router.patch("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SupplierOut:
    supplier = await suppliers_repo.get_by_id(db, tenant.id, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    supplier = await suppliers_repo.update(db, supplier, payload)
    await db.commit()
    return SupplierOut.model_validate(supplier)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    supplier = await suppliers_repo.get_by_id(db, tenant.id, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    await suppliers_repo.delete(db, supplier)
    await db.commit()
