import { apiRequest } from "@/lib/api-client";

export const PERMISSION_MODULES = [
  { key: "customers", label: "Customers & suppliers" },
  { key: "items", label: "Items" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments & accounts" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number]["key"];

export interface UserOut {
  id: string;
  email: string;
  role: "owner" | "staff";
  permissions: Record<string, boolean>;
  email_verified: boolean;
}

export interface StaffInput {
  email: string;
  password: string;
  permissions: Record<string, boolean>;
}

export const usersApi = {
  me: () => apiRequest<UserOut>("/users/me"),
  list: () => apiRequest<UserOut[]>("/users"),
  createStaff: (payload: StaffInput) =>
    apiRequest<UserOut>("/users", { method: "POST", body: JSON.stringify(payload) }),
  updatePermissions: (id: string, permissions: Record<string, boolean>) =>
    apiRequest<UserOut>(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ permissions }) }),
  remove: (id: string) => apiRequest<void>(`/users/${id}`, { method: "DELETE" }),
};
