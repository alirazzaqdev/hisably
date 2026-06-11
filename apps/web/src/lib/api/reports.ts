import { apiRequest } from "@/lib/api-client";

export interface DashboardKpis {
  total_customers: number;
  total_items: number;
  total_invoices: number;
  revenue_paid: string;
  outstanding_receivables: string;
  expenses_this_month: string;
  invoices_overdue: number;
}

export interface SalesTrendPoint {
  period: string;
  invoiced_total: string;
  paid_total: string;
}

export interface TopCustomer {
  customer_id: string;
  name: string;
  total_invoiced: string;
  total_paid: string;
}

export interface TopItem {
  item_id: string | null;
  description: string;
  quantity: string;
  revenue: string;
}

export interface ReceivablesAgingBucket {
  label: string;
  total: string;
  count: number;
}

export interface VatSummary {
  output_vat: string;
  input_vat: string;
  net_vat_due: string;
}

export const reportsApi = {
  kpis: () => apiRequest<DashboardKpis>("/dashboard/kpis"),
  salesTrend: (months = 6) => apiRequest<SalesTrendPoint[]>(`/dashboard/sales-trend?months=${months}`),
  topCustomers: (limit = 5) => apiRequest<TopCustomer[]>(`/dashboard/top-customers?limit=${limit}`),
  topItems: (limit = 5) => apiRequest<TopItem[]>(`/dashboard/top-items?limit=${limit}`),
  receivablesAging: () => apiRequest<ReceivablesAgingBucket[]>("/dashboard/receivables-aging"),
  vatSummary: (params: { dateFrom?: string; dateTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    const qs = query.toString();
    return apiRequest<VatSummary>(`/reports/vat-summary${qs ? `?${qs}` : ""}`);
  },
};
