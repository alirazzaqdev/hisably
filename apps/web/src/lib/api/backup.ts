import { apiRequest } from "@/lib/api-client";

export const backupApi = {
  export: () => apiRequest<Record<string, unknown>>("/backup/export"),
  import: (payload: Record<string, unknown>) =>
    apiRequest<{ status: string }>("/backup/import", { method: "POST", body: JSON.stringify(payload) }),
};
