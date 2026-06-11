import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import item_prices as item_prices_repo
from app.repositories import items as items_repo
from app.schemas.common import Page
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate
from app.schemas.price_list import ItemPriceInput, ItemPriceOut

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=Page[ItemOut])
async def list_items(
    search: str | None = Query(default=None),
    category_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Page[ItemOut]:
    items, total = await items_repo.list_paginated(
        db, tenant.id, search=search, category_id=category_id, page=page, page_size=page_size
    )
    return Page(items=[ItemOut.model_validate(i) for i in items], total=total, page=page, page_size=page_size)


@router.get("/low-stock", response_model=list[ItemOut])
async def list_low_stock_items(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ItemOut]:
    items = await items_repo.list_low_stock(db, tenant.id)
    return [ItemOut.model_validate(i) for i in items]


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ItemOut:
    item = await items_repo.create(db, tenant.id, payload)
    await db.commit()
    return ItemOut.model_validate(item)


@router.get("/by-barcode/{barcode}", response_model=ItemOut)
async def get_item_by_barcode(
    barcode: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ItemOut:
    item = await items_repo.get_by_barcode(db, tenant.id, barcode)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return ItemOut.model_validate(item)


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(
    item_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ItemOut:
    item = await items_repo.get_by_id(db, tenant.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return ItemOut.model_validate(item)


@router.patch("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ItemOut:
    item = await items_repo.get_by_id(db, tenant.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    item = await items_repo.update(db, item, payload)
    await db.commit()
    return ItemOut.model_validate(item)


@router.get("/{item_id}/prices", response_model=list[ItemPriceOut])
async def list_item_prices(
    item_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ItemPriceOut]:
    item = await items_repo.get_by_id(db, tenant.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    prices = await item_prices_repo.list_for_item(db, tenant.id, item_id)
    return [ItemPriceOut.model_validate(p) for p in prices]


@router.put("/{item_id}/prices", response_model=list[ItemPriceOut])
async def set_item_prices(
    item_id: uuid.UUID,
    payload: list[ItemPriceInput],
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ItemPriceOut]:
    item = await items_repo.get_by_id(db, tenant.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    prices = await item_prices_repo.set_for_item(db, tenant.id, item_id, payload)
    await db.commit()
    return [ItemPriceOut.model_validate(p) for p in prices]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    item = await items_repo.get_by_id(db, tenant.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    await items_repo.delete(db, item)
    await db.commit()
