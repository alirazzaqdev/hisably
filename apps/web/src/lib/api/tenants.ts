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
  industry_profile?: string;
  enabled_fields?: Record<string, boolean>;
  field_labels?: Record<string, string>;
}

export const tenantsApi = {
  me: () => apiRequest<TenantOut>("/tenants/me"),
  update: (payload: TenantUpdateInput) =>
    apiRequest<TenantOut>("/tenants/me", { method: "PATCH", body: JSON.stringify(payload) }),
};
