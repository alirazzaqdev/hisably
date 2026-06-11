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

export const accountsApi = {
  list: () => apiRequest<Account[]>("/accounts"),
  get: (id: string) => apiRequest<Account>(`/accounts/${id}`),
  create: (payload: AccountInput) =>
    apiRequest<Account>("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<AccountInput>) =>
    apiRequest<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiRequest<void>(`/accounts/${id}`, { method: "DELETE" }),
};
