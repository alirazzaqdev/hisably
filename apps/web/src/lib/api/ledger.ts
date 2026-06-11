import { apiRequest } from "@/lib/api-client";

export interface LedgerEntry {
  date: string;
  type: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface PartyStatement {
  party_id: string;
  party_name: string;
  opening_balance: string;
  closing_balance: string;
  entries: LedgerEntry[];
}

export const ledgerApi = {
  customerStatement: (customerId: string) => apiRequest<PartyStatement>(`/customers/${customerId}/statement`),
  supplierStatement: (supplierId: string) => apiRequest<PartyStatement>(`/suppliers/${supplierId}/statement`),
};
