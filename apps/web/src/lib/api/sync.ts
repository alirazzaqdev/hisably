import { apiRequest } from "@/lib/api-client";
import type { Customer } from "@/lib/api/customers";
import type { Expense } from "@/lib/api/expenses";
import type { Invoice } from "@/lib/api/invoices";
import type { Item } from "@/lib/api/items";
import type { Payment } from "@/lib/api/payments";

export type SyncEntityType = "customer" | "item" | "expense";

export interface SyncMutation {
  entity_type: SyncEntityType;
  client_uuid: string;
  data: Record<string, unknown>;
}

export interface SyncMutationResult {
  client_uuid: string;
  entity_type: string;
  status: "applied" | "duplicate" | "error";
  entity_id: string | null;
  error: string | null;
}

export interface SyncPushResponse {
  results: SyncMutationResult[];
  server_time: string;
}

export interface SyncPullResponse {
  server_time: string;
  customers: Customer[];
  items: Item[];
  expenses: Expense[];
  invoices: Invoice[];
  payments: Payment[];
}

export const syncApi = {
  push: (mutations: SyncMutation[]) =>
    apiRequest<SyncPushResponse>("/sync/push", { method: "POST", body: JSON.stringify({ mutations }) }),
  pull: (since?: string | null) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return apiRequest<SyncPullResponse>(`/sync/pull${qs}`);
  },
};
