import { apiRequest } from "@/lib/api-client";

export interface ItemCategory {
  id: string;
  name: string;
}

export interface ItemCategoryInput {
  name: string;
}

export const itemCategoriesApi = {
  list: () => apiRequest<ItemCategory[]>("/item-categories"),
  create: (payload: ItemCategoryInput) =>
    apiRequest<ItemCategory>("/item-categories", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<ItemCategoryInput>) =>
    apiRequest<ItemCategory>(`/item-categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/item-categories/${id}`, { method: "DELETE" }),
};
