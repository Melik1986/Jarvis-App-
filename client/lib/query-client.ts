import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";
import { useAuthStore } from "@/store/authStore";
import { extractErrorFromResponse } from "@/lib/error-handler";

export { getApiUrl };

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Try to refresh the token once; returns new token or null. */
async function tryRefreshToken(): Promise<string | null> {
  const refreshed = await useAuthStore.getState().refreshSession();
  if (refreshed) {
    return useAuthStore.getState().getAccessToken();
  }
  return null;
}

/** Build Authorization header from current store. */
function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// authenticatedFetch — single helper for all auth+retry needs
// ---------------------------------------------------------------------------

/**
 * Wrapper around native `fetch` that:
 * 1. Injects Bearer token automatically
 * 2. On 401 — refreshes token once and retries
 *
 * Use this for streaming / FormData / any call that can't use apiRequest().
 */
export async function authenticatedFetch(
  input: string | URL | RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = useAuthStore.getState().getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(input, { ...init, headers });

  // 401 → try refresh once
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(input, { ...init, headers });
    }
  }

  return res;
}

// ---------------------------------------------------------------------------
// apiRequest — JSON convenience (existing API, now with retry)
// ---------------------------------------------------------------------------

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const apiError = await extractErrorFromResponse(res);
    throw apiError;
  }
}

/**
 * Make an API request with automatic auth token injection and retry on 401.
 * Throws typed ApiErrorResponse on error.
 */
export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // 401 → refresh + retry once
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

// ---------------------------------------------------------------------------
// React-Query integration
// ---------------------------------------------------------------------------

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await authenticatedFetch(url);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
