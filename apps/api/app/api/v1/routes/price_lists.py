import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import item_prices as item_prices_repo
from app.repositories import price_lists as price_lists_repo
from app.schemas.price_list import (
    PriceListCreate,
    PriceListItemOut,
    PriceListOut,
    PriceListUpdate,
)

router = APIRouter(prefix="/price-lists", tags=["price-lists"])


@router.get("", response_model=list[PriceListOut])
async def list_price_lists(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[PriceListOut]:
    price_lists = await price_lists_repo.list_all(db, tenant.id)
    return [PriceListOut.model_validate(p) for p in price_lists]


@router.post("", response_model=PriceListOut, status_code=status.HTTP_201_CREATED)
async def create_price_list(
    payload: PriceListCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PriceListOut:
    price_list = await price_lists_repo.create(db, tenant.id, payload)
    await db.commit()
    return PriceListOut.model_validate(price_list)


@router.get("/{price_list_id}/prices", response_model=list[PriceListItemOut])
async def list_price_list_prices(
    price_list_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[PriceListItemOut]:
    price_list = await price_lists_repo.get_by_id(db, tenant.id, price_list_id)
    if price_list is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price list not found")
    prices = await item_prices_repo.list_for_price_list(db, tenant.id, price_list_id)
    return [PriceListItemOut.model_validate(p) for p in prices]


@router.patch("/{price_list_id}", response_model=PriceListOut)
async def update_price_list(
    price_list_id: uuid.UUID,
    payload: PriceListUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PriceListOut:
    price_list = await price_lists_repo.get_by_id(db, tenant.id, price_list_id)
    if price_list is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price list not found")
    price_list = await price_lists_repo.update(db, price_list, payload)
    await db.commit()
    return PriceListOut.model_validate(price_list)


@router.delete("/{price_list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price_list(
    price_list_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    price_list = await price_lists_repo.get_by_id(db, tenant.id, price_list_id)
    if price_list is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price list not found")
    await price_lists_repo.delete(db, price_list)
    await db.commit()
