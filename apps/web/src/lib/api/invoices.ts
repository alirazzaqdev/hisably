import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Page } from "@/lib/api/types";
import type { VatCategory } from "@/lib/api/items";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type InvoiceType = "tax_invoice" | "quotation" | "proforma" | "credit_note" | "debit_note" | "purchase_bill";
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";

export interface InvoiceLineItem {
  id: string;
  item_id: string | null;
  description: string;
  description_ar: string | null;
  quantity: string;
  width: string | null;
  height: string | null;
  unit_price: string;
  discount_percent: string | null;
  discount_amount: string | null;
  vat_category: VatCategory;
  vat_rate: string;
  vat_amount: string;
  line_total: string;
}

export interface InvoiceLineItemInput {
  item_id?: string | null;
  description: string;
  description_ar?: string | null;
  quantity?: string | null;
  width?: string | null;
  height?: string | null;
  unit_price: string;
  discount_percent?: string | null;
  discount_amount?: string | null;
  vat_category?: VatCategory;
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customer_id: string | null;
  supplier_id: string | null;
  invoice_number: string | null;
  draft_number: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  discount_amount: string;
  subtotal: string;
  discount_total: string;
  vat_total: string;
  grand_total: string;
  notes: string | null;
  terms: string | null;
  void_reason: string | null;
  converted_from_id: string | null;
  line_items: InvoiceLineItem[];
}

export interface InvoiceInput {
  type?: InvoiceType;
  customer_id?: string | null;
  supplier_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  currency?: string;
  discount_amount?: string;
  notes?: string | null;
  terms?: string | null;
  line_items: InvoiceLineItemInput[];
  converted_from_id?: string | null;
}

export const invoicesApi = {
  list: (params: { search?: string; status?: InvoiceStatus; type?: InvoiceType; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.type) query.set("type", params.type);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Invoice>>(`/invoices${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Invoice>(`/invoices/${id}`),
  create: (payload: InvoiceInput) =>
    apiRequest<Invoice>("/invoices", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<InvoiceInput>) =>
    apiRequest<Invoice>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setStatus: (id: string, status: InvoiceStatus, voidReason?: string) =>
    apiRequest<Invoice>(`/invoices/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, void_reason: voidReason }),
    }),
  remove: (id: string) => apiRequest<void>(`/invoices/${id}`, { method: "DELETE" }),
  pdfBlob: async (id: string): Promise<Blob> => {
    const { accessToken } = useAuthStore.getState();
    const res = await fetch(`${API_BASE_URL}/invoices/${id}/pdf`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },
};
