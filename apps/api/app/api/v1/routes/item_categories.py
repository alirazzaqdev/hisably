import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import item_categories as item_categories_repo
from app.schemas.item_category import ItemCategoryCreate, ItemCategoryOut, ItemCategoryUpdate

router = APIRouter(prefix="/item-categories", tags=["item-categories"])


@router.get("", response_model=list[ItemCategoryOut])
async def list_item_categories(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[ItemCategoryOut]:
    categories = await item_categories_repo.list_all(db, tenant.id)
    return [ItemCategoryOut.model_validate(c) for c in categories]


@router.post("", response_model=ItemCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_item_category(
    payload: ItemCategoryCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ItemCategoryOut:
    category = await item_categories_repo.create(db, tenant.id, payload)
    await db.commit()
    return ItemCategoryOut.model_validate(category)


@router.patch("/{category_id}", response_model=ItemCategoryOut)
async def update_item_category(
    category_id: uuid.UUID,
    payload: ItemCategoryUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ItemCategoryOut:
    category = await item_categories_repo.get_by_id(db, tenant.id, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    category = await item_categories_repo.update(db, category, payload)
    await db.commit()
    return ItemCategoryOut.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item_category(
    category_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    category = await item_categories_repo.get_by_id(db, tenant.id, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await item_categories_repo.delete(db, category)
    await db.commit()
