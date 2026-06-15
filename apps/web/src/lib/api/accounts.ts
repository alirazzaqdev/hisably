import { apiRequest } from "@/lib/api-client";

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
};
