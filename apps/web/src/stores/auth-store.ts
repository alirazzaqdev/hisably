import { create } from "zustand";
import { persist, type StateStorage } from "zustand/middleware";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (tokens: AuthTokens, remember?: boolean) => void;
  clearSession: () => void;
}

const REMEMBER_KEY = "hisably-remember";

// Middleware can't read localStorage, so a lightweight non-sensitive cookie
// mirrors "is there a session" for route-protection checks.
function syncSessionCookie(hasSession: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = hasSession
    ? "hisably_session=1; path=/; max-age=2592000; samesite=lax"
    : "hisably_session=; path=/; max-age=0; samesite=lax";
}

// "Remember me" controls whether the session survives closing the browser
// (localStorage) or is cleared at the end of the tab session (sessionStorage).
const rememberAwareStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name, value) => {
    if (localStorage.getItem(REMEMBER_KEY) === "0") {
      sessionStorage.setItem(name, value);
      localStorage.removeItem(name);
    } else {
      localStorage.setItem(name, value);
      sessionStorage.removeItem(name);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setSession: (tokens, remember = true) => {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
        }
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
      storage: {
        getItem: (name) => {
          const value = rememberAwareStorage.getItem(name);
          return value === null ? null : JSON.parse(value as string);
        },
        setItem: (name, value) => rememberAwareStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => rememberAwareStorage.removeItem(name),
      },
      onRehydrateStorage: () => (state) => {
        syncSessionCookie(Boolean(state?.accessToken));
      },
    }
  )
);
