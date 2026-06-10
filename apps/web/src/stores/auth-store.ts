import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (tokens: AuthTokens) => void;
  clearSession: () => void;
}

// Middleware can't read localStorage, so a lightweight non-sensitive cookie
// mirrors "is there a session" for route-protection checks.
function syncSessionCookie(hasSession: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = hasSession
    ? "hisably_session=1; path=/; max-age=2592000; samesite=lax"
    : "hisably_session=; path=/; max-age=0; samesite=lax";
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setSession: (tokens) => {
        syncSessionCookie(true);
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      },
      clearSession: () => {
        syncSessionCookie(false);
        set({ accessToken: null, refreshToken: null });
      },
    }),
    {
      name: "hisably-auth",
      onRehydrateStorage: () => (state) => {
        syncSessionCookie(Boolean(state?.accessToken));
      },
    }
  )
);
