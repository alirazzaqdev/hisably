import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";

export interface Customer {
  id: string;
  name: string;
  name_ar: string | null;
  trn: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  opening_balance: string;
  credit_limit: string | null;
  price_list_id: string | null;
}

export interface CustomerInput {
  name: string;
  name_ar?: string | null;
  trn?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  opening_balance?: string;
  credit_limit?: string | null;
  price_list_id?: string | null;
}

export const customersApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Customer>>(`/customers${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Customer>(`/customers/${id}`),
  create: (payload: CustomerInput) =>
    apiRequest<Customer>("/customers", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CustomerInput>) =>
    apiRequest<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/customers/${id}`, { method: "DELETE" }),
};
