import { apiRequest } from "@/lib/api-client";
import type { Country } from "@hisably/shared";
import type { TenantOut, VatCategory } from "@/lib/api/onboarding";

export interface TenantUpdateInput {
  business_name?: string;
  trn?: string | null;
  vat_registered?: boolean;
  address?: string | null;
  country?: Country;
  currency?: string;
  vat_rate?: string;
  logo_url?: string | null;
  invoice_prefix?: string;
  quotation_prefix?: string;
  default_vat_category?: VatCategory;
  industry_profile?: string;
  enabled_fields?: Record<string, boolean>;
  field_labels?: Record<string, string>;
  cheque_payee_name?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_iban?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  stamp_url?: string | null;
  signature_url?: string | null;
  branding_options?: Record<string, Record<string, boolean>>;
}

export const tenantsApi = {
  me: () => apiRequest<TenantOut>("/tenants/me"),
  update: (payload: TenantUpdateInput) =>
    apiRequest<TenantOut>("/tenants/me", { method: "PATCH", body: JSON.stringify(payload) }),
};
