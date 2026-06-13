import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";

export interface Expense {
  id: string;
  category: string;
  amount: string;
  vat_paid: string;
  supplier_id: string | null;
  expense_date: string;
  notes: string | null;
  attachment_id: string | null;
  attachment_url: string | null;
}

export interface ExpenseInput {
  category: string;
  amount: string;
  vat_paid?: string;
  supplier_id?: string | null;
  expense_date: string;
  notes?: string | null;
  attachment_id?: string | null;
}

export const expensesApi = {
  list: (
    params: {
      category?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Expense>>(`/expenses${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Expense>(`/expenses/${id}`),
  create: (payload: ExpenseInput) =>
    apiRequest<Expense>("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<ExpenseInput>) =>
    apiRequest<Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/expenses/${id}`, { method: "DELETE" }),
};
