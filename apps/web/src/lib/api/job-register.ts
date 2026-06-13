import { apiRequest } from "@/lib/api-client";
import type { Page } from "@/lib/api/types";

export type JobWorkStatus = "not_completed" | "in_progress" | "completed";
export type JobTaxInvoiceStatus = "not_submitted" | "submitted";
export type JobPaymentStatus = "lpo_not_received" | "pending" | "received" | "not_received";

export interface JobRegisterRow {
  id: string;
  qt_no: string | null;
  quotation_id: string | null;
  lpo_no: string | null;
  villa_no: string | null;
  description: string;
  rate: string;
  vat: string;
  override_total: string | null;
  total: string;
  customer_id: string | null;
  company_text: string | null;
  work_status: JobWorkStatus;
  tax_invoice_status: JobTaxInvoiceStatus;
  payment_status: JobPaymentStatus;
  remarks: string | null;
  source_invoice_id: string | null;
  sort_order: number;
}

export interface JobRegisterRowInput {
  qt_no?: string | null;
  quotation_id?: string | null;
  lpo_no?: string | null;
  villa_no?: string | null;
  description: string;
  rate?: string;
  override_total?: string | null;
  customer_id?: string | null;
  company_text?: string | null;
  work_status?: JobWorkStatus;
  tax_invoice_status?: JobTaxInvoiceStatus;
  payment_status?: JobPaymentStatus;
  remarks?: string | null;
  source_invoice_id?: string | null;
  sort_order?: number;
}

export interface JobRegisterRowUpdate extends Partial<JobRegisterRowInput> {
  clear_override_total?: boolean;
}

export interface JobReceipt {
  id: string;
  customer_id: string | null;
  company_text: string | null;
  amount: string;
  receipt_date: string;
  note: string | null;
  linked_payment_id: string | null;
}

export interface JobReceiptInput {
  customer_id?: string | null;
  company_text?: string | null;
  amount: string;
  receipt_date: string;
  note?: string | null;
  linked_payment_id?: string | null;
}

export interface JobRegisterSummary {
  total_work_value: string;
  total_submitted: string;
  total_received: string;
  total_received_by_status: string;
  balance: string;
}

export interface JobRegisterListParams {
  customer_id?: string;
  work_status?: JobWorkStatus;
  tax_invoice_status?: JobTaxInvoiceStatus;
  payment_status?: JobPaymentStatus;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(params: JobRegisterListParams): string {
  const query = new URLSearchParams();
  if (params.customer_id) query.set("customer_id", params.customer_id);
  if (params.work_status) query.set("work_status", params.work_status);
  if (params.tax_invoice_status) query.set("tax_invoice_status", params.tax_invoice_status);
  if (params.payment_status) query.set("payment_status", params.payment_status);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export const jobRegisterApi = {
  list: (params: JobRegisterListParams = {}) =>
    apiRequest<Page<JobRegisterRow>>(`/job-register/rows${buildQuery(params)}`),
  summary: (params: JobRegisterListParams = {}) =>
    apiRequest<JobRegisterSummary>(`/job-register/summary${buildQuery(params)}`),
  createRow: (payload: JobRegisterRowInput) =>
    apiRequest<JobRegisterRow>("/job-register/rows", { method: "POST", body: JSON.stringify(payload) }),
  updateRow: (id: string, payload: JobRegisterRowUpdate) =>
    apiRequest<JobRegisterRow>(`/job-register/rows/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeRow: (id: string) => apiRequest<void>(`/job-register/rows/${id}`, { method: "DELETE" }),
  listReceipts: () => apiRequest<JobReceipt[]>("/job-register/receipts"),
  createReceipt: (payload: JobReceiptInput) =>
    apiRequest<JobReceipt>("/job-register/receipts", { method: "POST", body: JSON.stringify(payload) }),
  updateReceipt: (id: string, payload: Partial<JobReceiptInput>) =>
    apiRequest<JobReceipt>(`/job-register/receipts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeReceipt: (id: string) => apiRequest<void>(`/job-register/receipts/${id}`, { method: "DELETE" }),
};
