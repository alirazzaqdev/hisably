import { apiRequest } from "@/lib/api-client";
import type { TenantOut, VatCategory } from "@/lib/api/onboarding";

export interface TenantUpdateInput {
  business_name?: string;
  trn?: string | null;
  vat_registered?: boolean;
  address?: string | null;
  logo_url?: string | null;
  invoice_prefix?: string;
  default_vat_category?: VatCategory;
}

export const tenantsApi = {
  me: () => apiRequest<TenantOut>("/tenants/me"),
  update: (payload: TenantUpdateInput) =>
    apiRequest<TenantOut>("/tenants/me", { method: "PATCH", body: JSON.stringify(payload) }),
};
