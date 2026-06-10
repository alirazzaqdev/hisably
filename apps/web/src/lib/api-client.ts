import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions extends RequestInit {
  /** Attach the stored access token and retry once via /auth/refresh on 401. Default true. */
  auth?: boolean;
}

async function parseError(res: Response): Promise<unknown> {
  try {
    const body = await res.json();
    return body?.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        clearSession();
        return false;
      }

      const data = await res.json();
      setSession({ accessToken: data.access_token, refreshToken: data.refresh_token });
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (auth) {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && auth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Content-Type", "application/json");
      retryHeaders.set("Authorization", `Bearer ${useAuthStore.getState().accessToken}`);
      const retryRes = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
      if (!retryRes.ok) throw new ApiError(retryRes.status, await parseError(retryRes));
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
