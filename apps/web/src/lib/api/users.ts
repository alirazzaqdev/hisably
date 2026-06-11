import { apiRequest } from "@/lib/api-client";

export interface UserOut {
  id: string;
  email: string;
  role: "owner" | "staff";
  email_verified: boolean;
}

export const usersApi = {
  me: () => apiRequest<UserOut>("/users/me"),
};
