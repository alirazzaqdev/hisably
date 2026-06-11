import { apiRequest } from "@/lib/api-client";
import type { Country } from "@hisably/shared";

export interface Firm {
  id: string;
  business_name: string;
  country: Country;
  currency: string;
  is_active: boolean;
}

export interface FirmCreateInput {
  business_name: string;
  country: Country;
}

export interface FirmTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const firmsApi = {
  list: () => apiRequest<Firm[]>("/firms"),
  create: (payload: FirmCreateInput) =>
    apiRequest<Firm>("/firms", { method: "POST", body: JSON.stringify(payload) }),
  switch: (firmId: string) => apiRequest<FirmTokens>(`/firms/${firmId}/switch`, { method: "POST" }),
};
