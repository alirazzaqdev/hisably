import { apiRequest } from "@/lib/api-client";
import type { Country } from "@hisably/shared";

export interface OnboardingBusinessRequest {
  business_name: string;
  country: Country;
  trn?: string | null;
  vat_registered: boolean;
  invoice_prefix: string;
  invoice_starting_number: number;
}

export type VatCategory = "standard" | "zero_rated" | "exempt";

export interface TenantOut {
  id: string;
  business_name: string;
  country: Country;
  currency: string;
  vat_registered: boolean;
  trn: string | null;
  address: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  default_vat_category: VatCategory;
  industry_profile: string;
  enabled_fields: Record<string, boolean>;
  field_labels: Record<string, string>;
  resolved_fields: Record<string, boolean>;
}

export const onboardingApi = {
  updateBusiness: (payload: OnboardingBusinessRequest) =>
    apiRequest<TenantOut>("/onboarding/business", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
