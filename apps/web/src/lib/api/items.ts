import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";

export type ItemUnit = "pcs" | "sqm" | "sqft" | "kg" | "m" | "box" | "ltr";
export type VatCategory = "standard" | "zero_rated" | "exempt";

export interface Item {
  id: string;
  name: string;
  name_ar: string | null;
  sku: string | null;
  unit: ItemUnit;
  is_area_based: boolean;
  sale_price: string;
  purchase_price: string;
  vat_category: VatCategory;
  track_inventory: boolean;
  current_stock: string | null;
  low_stock_threshold: string | null;
}

export interface ItemInput {
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  unit?: ItemUnit;
  is_area_based?: boolean;
  sale_price?: string;
  purchase_price?: string;
  vat_category?: VatCategory;
  track_inventory?: boolean;
  current_stock?: string | null;
  low_stock_threshold?: string | null;
}

export const itemsApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Item>>(`/items${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Item>(`/items/${id}`),
  lowStock: () => apiRequest<Item[]>("/items/low-stock"),
  create: (payload: ItemInput) => apiRequest<Item>("/items", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<ItemInput>) =>
    apiRequest<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/items/${id}`, { method: "DELETE" }),
};
