import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type AccountType = "cash" | "bank";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank_name: string | null;
  account_number: string | null;
  opening_balance: string;
  current_balance: string;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  bank_name?: string | null;
  account_number?: string | null;
  opening_balance?: string;
}

export interface AccountTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  transfer_date: string;
  notes: string | null;
}

export interface AccountTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  transfer_date: string;
  notes?: string | null;
}

export interface AccountStatementEntry {
  date: string;
  description: string;
  amount_in: string;
  amount_out: string;
  balance: string;
}

export interface AccountStatement {
  account_id: string;
  account_name: string;
  date_from: string | null;
  date_to: string | null;
  opening_balance: string;
  closing_balance: string;
  entries: AccountStatementEntry[];
}

export const accountsApi = {
  list: () => apiRequest<Account[]>("/accounts"),
  get: (id: string) => apiRequest<Account>(`/accounts/${id}`),
  create: (payload: AccountInput) =>
    apiRequest<Account>("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<AccountInput>) =>
    apiRequest<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/accounts/${id}`, { method: "DELETE" }),
  listTransfers: (accountId?: string) => {
    const qs = accountId ? `?account_id=${accountId}` : "";
    return apiRequest<AccountTransfer[]>(`/accounts/transfers${qs}`);
  },
  createTransfer: (payload: AccountTransferInput) =>
    apiRequest<AccountTransfer>("/accounts/transfers", { method: "POST", body: JSON.stringify(payload) }),
  getStatement: (id: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    return apiRequest<AccountStatement>(`/accounts/${id}/statement${qs ? `?${qs}` : ""}`);
  },
  statementFileBlob: async (id: string, format: "pdf" | "csv", dateFrom?: string, dateTo?: string): Promise<Blob> => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    const { accessToken } = useAuthStore.getState();
    const res = await fetch(`${API_BASE_URL}/accounts/${id}/statement/${format}${qs ? `?${qs}` : ""}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },
};
