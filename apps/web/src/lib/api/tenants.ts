import { apiRequest } from "@/lib/api-client";
import type { TenantOut } from "@/lib/api/onboarding";

export const tenantsApi = {
  me: () => apiRequest<TenantOut>("/tenants/me"),
};
