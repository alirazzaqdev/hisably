import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";
import type { Invoice, QuotationStatus } from "@/lib/api/invoices";

export interface QuotationCounts {
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  total: number;
}

export const quotationsApi = {
  list: (params: { search?: string; status?: QuotationStatus; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Invoice>>(`/quotations${qs ? `?${qs}` : ""}`);
  },
  counts: () => apiRequest<QuotationCounts>("/quotations/counts"),
  setStatus: (id: string, status: QuotationStatus, dueDate?: string) =>
    apiRequest<Invoice>(`/quotations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, due_date: dueDate }),
    }),
};
