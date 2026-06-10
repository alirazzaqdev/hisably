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

export interface TenantOut {
  id: string;
  business_name: string;
  country: Country;
  currency: string;
  vat_registered: boolean;
  trn: string | null;
  logo_url: string | null;
  invoice_prefix: string;
}

export const onboardingApi = {
  updateBusiness: (payload: OnboardingBusinessRequest) =>
    apiRequest<TenantOut>("/onboarding/business", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
