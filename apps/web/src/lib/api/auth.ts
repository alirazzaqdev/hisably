import { apiRequest } from "@/lib/api-client";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  email: string;
  role: string;
  email_verified: boolean;
}

export interface MessageResponse {
  message: string;
}

export const authApi = {
  signup: (email: string, password: string) =>
    apiRequest<UserOut>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    }),

  verifyOtp: (email: string, otpCode: string) =>
    apiRequest<TokenResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp_code: otpCode }),
      auth: false,
    }),

  resendOtp: (email: string) =>
    apiRequest<MessageResponse>("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    }),

  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    }),

  logout: (refreshToken: string) =>
    apiRequest<MessageResponse>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      auth: false,
    }),

  forgotPassword: (email: string) =>
    apiRequest<MessageResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    }),

  resetPassword: (email: string, otpCode: string, newPassword: string) =>
    apiRequest<MessageResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
      auth: false,
    }),
};
