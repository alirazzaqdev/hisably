import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";
import type { InvoiceStatus } from "@/lib/api/invoices";

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "other";
export type ChequeStatus = "pending" | "cleared" | "bounced";

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
  account_id: string | null;
  amount: string;
  method: PaymentMethod;
  reference_no: string | null;
  payment_date: string;
  notes: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  cheque_status: ChequeStatus | null;
  voided_at: string | null;
  void_reason: string | null;
  allocations: PaymentAllocation[];
}

export interface PaymentInput {
  customer_id?: string | null;
  supplier_id?: string | null;
  account_id?: string | null;
  amount: string;
  method: PaymentMethod;
  reference_no?: string | null;
  payment_date: string;
  notes?: string | null;
  cheque_number?: string | null;
  cheque_date?: string | null;
  allocations: PaymentAllocationInput[];
}

export interface PaymentUpdateInput {
  account_id?: string | null;
  amount?: string;
  method?: PaymentMethod;
  reference_no?: string | null;
  payment_date?: string;
  notes?: string | null;
  cheque_number?: string | null;
  cheque_date?: string | null;
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
  list: (
    params: {
      customerId?: string;
      supplierId?: string;
      accountId?: string;
      method?: PaymentMethod;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.customerId) query.set("customer_id", params.customerId);
    if (params.supplierId) query.set("supplier_id", params.supplierId);
    if (params.accountId) query.set("account_id", params.accountId);
    if (params.method) query.set("method", params.method);
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    const qs = query.toString();
    return apiRequest<Page<Payment>>(`/payments${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiRequest<Payment>(`/payments/${id}`),
  create: (payload: PaymentInput) =>
    apiRequest<Payment>("/payments", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: PaymentUpdateInput) =>
    apiRequest<Payment>(`/payments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  void: (id: string, reason: string) =>
    apiRequest<Payment>(`/payments/${id}/void`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  addAllocations: (id: string, allocations: PaymentAllocationInput[]) =>
    apiRequest<Payment>(`/payments/${id}/allocations`, {
      method: "POST",
      body: JSON.stringify({ allocations }),
    }),
  remove: (id: string) => apiRequest<void>(`/payments/${id}`, { method: "DELETE" }),
  setChequeStatus: (id: string, chequeStatus: ChequeStatus) =>
    apiRequest<Payment>(`/payments/${id}/cheque-status`, {
      method: "PATCH",
      body: JSON.stringify({ cheque_status: chequeStatus }),
    }),
  receivables: () => apiRequest<Receivable[]>("/receivables"),
  payables: () => apiRequest<Receivable[]>("/payables"),
};
