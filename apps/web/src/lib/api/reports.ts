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

export interface DayBookEntry {
  id: string;
  entry_date: string;
  type: string;
  reference: string;
  party_name: string | null;
  amount: string;
  direction: "in" | "out";
}

export interface DayBookResponse {
  entries: DayBookEntry[];
  total_in: string;
  total_out: string;
}

export interface StockSummaryItem {
  item_id: string;
  name: string;
  sku: string | null;
  unit: string;
  current_stock: string;
  purchase_price: string;
  stock_value: string;
}

export interface StockSummaryResponse {
  items: StockSummaryItem[];
  total_stock_value: string;
}

export interface ExpenseCategoryTotal {
  category: string;
  amount: string;
}

export interface ProfitLossResponse {
  sales_revenue: string;
  sales_returns: string;
  net_revenue: string;
  cost_of_goods_sold: string;
  gross_profit: string;
  expenses_by_category: ExpenseCategoryTotal[];
  total_expenses: string;
  net_profit: string;
}

export interface BalanceSheetResponse {
  cash_and_bank: string;
  accounts_receivable: string;
  inventory_value: string;
  total_assets: string;
  accounts_payable: string;
  total_liabilities: string;
  equity: string;
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
  dayBook: (params: { dateFrom?: string; dateTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    const qs = query.toString();
    return apiRequest<DayBookResponse>(`/reports/day-book${qs ? `?${qs}` : ""}`);
  },
  stockSummary: () => apiRequest<StockSummaryResponse>("/reports/stock-summary"),
  profitLoss: (params: { dateFrom?: string; dateTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    const qs = query.toString();
    return apiRequest<ProfitLossResponse>(`/reports/profit-loss${qs ? `?${qs}` : ""}`);
  },
  balanceSheet: () => apiRequest<BalanceSheetResponse>("/reports/balance-sheet"),
};
