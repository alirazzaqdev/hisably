import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";
import type { InvoiceStatus } from "@/lib/api/invoices";

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "other";

export interface PaymentAllocation {
  id: string;
  invoice_id: string;
  amount_allocated: string;
}

export interface PaymentAllocationInput {
  invoice_id: string;
  amount: string;
}

export interface Payment {
  id: string;
  customer_id: string | null;
  supplier_id: string | null;
  amount: string;
  method: PaymentMethod;
  reference_no: string | null;
  payment_date: string;
  notes: string | null;
  allocations: PaymentAllocation[];
}

export interface PaymentInput {
  customer_id?: string | null;
  supplier_id?: string | null;
  amount: string;
  method: PaymentMethod;
  reference_no?: string | null;
  payment_date: string;
  notes?: string | null;
  allocations: PaymentAllocationInput[];
}

export interface Receivable {
  invoice_id: string;
  invoice_number: string | null;
  draft_number: string;
  customer_id: string | null;
  issue_date: string;
  due_date: string | null;
  currency: string;
  grand_total: string;
  paid_amount: string;
  balance_due: string;
  status: InvoiceStatus;
}

export const paymentsApi = {
  list: (params: { customerId?: string; supplierId?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.customerId) query.set("customer_id", params.customerId);
    if (params.supplierId) query.set("supplier_id", params.supplierId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Payment>>(`/payments${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Payment>(`/payments/${id}`),
  create: (payload: PaymentInput) =>
    apiRequest<Payment>("/payments", { method: "POST", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/payments/${id}`, { method: "DELETE" }),
  receivables: () => apiRequest<Receivable[]>("/receivables"),
  payables: () => apiRequest<Receivable[]>("/payables"),
};
