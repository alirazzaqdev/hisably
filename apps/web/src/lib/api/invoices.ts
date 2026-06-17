import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Page } from "@/lib/api/types";
import type { VatCategory } from "@/lib/api/items";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type InvoiceType = "tax_invoice" | "quotation" | "proforma" | "credit_note" | "debit_note" | "purchase_bill";
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
export type QuotationStatus = "draft" | "pending" | "approved" | "rejected" | "expired";
export type PdfTemplate = "minimal" | "classic" | "bold";
export type InvoiceLanguage = "en" | "ar" | "bilingual";

export interface InvoiceLineItem {
  id: string;
  item_id: string | null;
  description: string;
  description_ar: string | null;
  unit: string | null;
  quantity: string;
  width_mm: string | null;
  height_mm: string | null;
  length_mm: string | null;
  unit_price: string;
  discount_percent: string | null;
  discount_amount: string | null;
  computed_total: string | null;
  override_total: string | null;
  final_payment_factor: string | null;
  vat_category: VatCategory;
  vat_rate: string;
  vat_amount: string;
  line_total: string;
}

export interface InvoiceLineItemInput {
  item_id?: string | null;
  description: string;
  description_ar?: string | null;
  unit?: string | null;
  quantity?: string | null;
  width_mm?: string | null;
  height_mm?: string | null;
  length_mm?: string | null;
  unit_price: string;
  discount_percent?: string | null;
  discount_amount?: string | null;
  override_total?: string | null;
  final_payment_factor?: string | null;
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
  exchange_rate: string;
  discount_amount: string;
  subtotal: string;
  discount_total: string;
  vat_total: string;
  grand_total: string;
  notes: string | null;
  terms: string | null;
  pdf_template: PdfTemplate;
  accent_color: string | null;
  language: InvoiceLanguage;
  lpo_no: string | null;
  project_villa_no: string | null;
  bill_to_address: string | null;
  ship_to_address: string | null;
  site_image_url: string | null;
  site_image_after_url: string | null;
  void_reason: string | null;
  converted_from_id: string | null;
  public_token: string | null;
  quotation_status: QuotationStatus | null;
  effective_quotation_status: QuotationStatus | null;
  paid_amount: string;
  balance_due: string;
  line_items: InvoiceLineItem[];
}

export interface InvoiceInput {
  type?: InvoiceType;
  customer_id?: string | null;
  supplier_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  currency?: string;
  exchange_rate?: string;
  discount_amount?: string;
  notes?: string | null;
  terms?: string | null;
  pdf_template?: PdfTemplate;
  accent_color?: string | null;
  language?: InvoiceLanguage;
  lpo_no?: string | null;
  project_villa_no?: string | null;
  bill_to_address?: string | null;
  ship_to_address?: string | null;
  site_image_url?: string | null;
  site_image_after_url?: string | null;
  line_items: InvoiceLineItemInput[];
  converted_from_id?: string | null;
}

export interface InvoicePayment {
  id: string;
  amount: string;
  allocated_amount: string;
  method: import("@/lib/api/payments").PaymentMethod;
  reference_no: string | null;
  payment_date: string;
  notes: string | null;
  voided_at: string | null;
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
  share: (id: string) => apiRequest<Invoice>(`/invoices/${id}/share`, { method: "POST" }),
  payments: (id: string) => apiRequest<InvoicePayment[]>(`/invoices/${id}/payments`),
  publicPdfUrl: (token: string) => `${API_BASE_URL}/public/invoices/${token}/pdf`,
  pdfBlob: async (id: string): Promise<Blob> => {
    const doFetch = () => {
      const { accessToken } = useAuthStore.getState();
      return fetch(`${API_BASE_URL}/invoices/${id}/pdf`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
    };
    let res = await doFetch();
    if (res.status === 401) {
      const { refreshToken, setSession, clearSession } = useAuthStore.getState();
      if (refreshToken) {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setSession({ accessToken: data.access_token, refreshToken: data.refresh_token });
          res = await doFetch();
        } else {
          clearSession();
        }
      }
    }
    if (!res.ok) throw new ApiError(res.status, await res.text().then((t) => t || res.statusText));
    return res.blob();
  },
};
