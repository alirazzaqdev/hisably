import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";
import type { Invoice } from "@/lib/api/invoices";
import type { VatCategory } from "@/lib/api/items";

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringInvoiceLineItem {
  item_id?: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  vat_category: VatCategory;
}

export interface RecurringInvoice {
  id: string;
  customer_id: string | null;
  frequency: RecurrenceFrequency;
  start_date: string;
  next_run_date: string;
  end_date: string | null;
  is_active: boolean;
  currency: string;
  discount_amount: string;
  notes: string | null;
  terms: string | null;
  line_items: RecurringInvoiceLineItem[];
  last_generated_invoice_id: string | null;
}

export interface RecurringInvoiceInput {
  customer_id?: string | null;
  frequency: RecurrenceFrequency;
  start_date: string;
  end_date?: string | null;
  currency?: string;
  discount_amount?: string;
  notes?: string | null;
  terms?: string | null;
  line_items: RecurringInvoiceLineItem[];
}

export const recurringInvoicesApi = {
  list: (params: { page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<RecurringInvoice>>(`/recurring-invoices${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<RecurringInvoice>(`/recurring-invoices/${id}`),
  create: (payload: RecurringInvoiceInput) =>
    apiRequest<RecurringInvoice>("/recurring-invoices", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<RecurringInvoiceInput> & { is_active?: boolean }) =>
    apiRequest<RecurringInvoice>(`/recurring-invoices/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/recurring-invoices/${id}`, { method: "DELETE" }),
  generateNow: (id: string) =>
    apiRequest<Invoice>(`/recurring-invoices/${id}/generate-now`, { method: "POST" }),
};
