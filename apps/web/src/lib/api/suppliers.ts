import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";

export interface Supplier {
  id: string;
  name: string;
  name_ar: string | null;
  trn: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  opening_balance: string;
}

export interface SupplierInput {
  name: string;
  name_ar?: string | null;
  trn?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  opening_balance?: string;
}

export const suppliersApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Supplier>>(`/suppliers${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Supplier>(`/suppliers/${id}`),
  create: (payload: SupplierInput) =>
    apiRequest<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<SupplierInput>) =>
    apiRequest<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/suppliers/${id}`, { method: "DELETE" }),
};
