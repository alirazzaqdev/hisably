import { apiRequest } from "@/lib/api-client";

export interface PriceList {
  id: string;
  name: string;
}

export interface PriceListInput {
  name: string;
}

export interface ItemPrice {
  price_list_id: string;
  price: string;
}

export interface ItemPriceInput {
  price_list_id: string;
  price: string;
}

export interface PriceListItem {
  item_id: string;
  price: string;
}

export const priceListsApi = {
  list: () => apiRequest<PriceList[]>("/price-lists"),
  create: (payload: PriceListInput) =>
    apiRequest<PriceList>("/price-lists", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<PriceListInput>) =>
    apiRequest<PriceList>(`/price-lists/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/price-lists/${id}`, { method: "DELETE" }),
  itemPrices: (id: string) => apiRequest<PriceListItem[]>(`/price-lists/${id}/prices`),
};

export const itemPricesApi = {
  list: (itemId: string) => apiRequest<ItemPrice[]>(`/items/${itemId}/prices`),
  set: (itemId: string, payload: ItemPriceInput[]) =>
    apiRequest<ItemPrice[]>(`/items/${itemId}/prices`, { method: "PUT", body: JSON.stringify(payload) }),
};
