import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";
import { useAuthStore } from "@/store/authStore";
import { extractErrorFromResponse } from "@/lib/error-handler";
import {
  encryptCredentialsToJWE,
  EphemeralCredentials,
} from "@/lib/jwe-encryption";

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

const CREDENTIAL_SESSION_DEFAULT_TTL_MS = 15 * 60 * 1000;
const CREDENTIAL_SESSION_REFRESH_SKEW_MS = 15 * 1000;
const ENABLE_DIRECT_JWE = process.env.EXPO_PUBLIC_AXON_ENABLE_JWE === "true";

async function handleUnauthorizedAfterRetry(): Promise<void> {
  try {
    clearCredentialSessionCache();
    await useAuthStore.getState().signOut();
  } catch {
    // Ignore sign-out errors, original HTTP error is handled by caller.
  }
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
    } else {
      await handleUnauthorizedAfterRetry();
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

function normalizeApiRoute(route: string): string {
  if (/^https?:\/\//i.test(route)) return route;
  const trimmed = route.trim();
  if (!trimmed) return "/api";
  const withoutLeadingSlash = trimmed.startsWith("/")
    ? trimmed.slice(1)
    : trimmed;
  if (withoutLeadingSlash.startsWith("api/")) return `/${withoutLeadingSlash}`;
  return `/api/${withoutLeadingSlash}`;
}

// ---------------------------------------------------------------------------
// secureApiRequest — JSON with JWE transport for secrets + session token
// ---------------------------------------------------------------------------

let cachedPublicKey: string | null = null;
let cachedSessionToken: string | null = null;
let cachedSessionTokenExpiresAt = 0;
let cachedCredentialFingerprint: string | null = null;
let cachedAuthTokenForCredentialSession: string | null = null;

function clearCredentialSessionCache(): void {
  cachedSessionToken = null;
  cachedSessionTokenExpiresAt = 0;
  cachedCredentialFingerprint = null;
  cachedAuthTokenForCredentialSession = null;
}

function invalidateCredentialSessionIfAuthChanged(): void {
  const currentAuthToken = useAuthStore.getState().getAccessToken();
  if (cachedAuthTokenForCredentialSession !== currentAuthToken) {
    clearCredentialSessionCache();
  }
}

function hasUsableCredentialSessionToken(): boolean {
  if (!cachedSessionToken) return false;
  return (
    Date.now() + CREDENTIAL_SESSION_REFRESH_SKEW_MS <
    cachedSessionTokenExpiresAt
  );
}

function stableCredentialFingerprint(
  credentials: EphemeralCredentials,
): string {
  const entries = Object.entries(credentials)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function hasSensitiveCredentialValues(
  credentials: EphemeralCredentials,
): boolean {
  return Boolean(
    credentials.llmKey ||
    credentials.dbKey ||
    credentials.dbUrl ||
    credentials.erpPassword ||
    credentials.erpApiKey,
  );
}

function buildCredentialBootstrapBody(
  credentials: EphemeralCredentials,
): Record<string, unknown> {
  return {
    ...(credentials.llmKey || credentials.llmProvider || credentials.llmBaseUrl
      ? {
          llmSettings: {
            ...(credentials.llmProvider && {
              provider: credentials.llmProvider,
            }),
            ...(credentials.llmBaseUrl && { baseUrl: credentials.llmBaseUrl }),
            ...(credentials.llmKey && { apiKey: credentials.llmKey }),
          },
        }
      : {}),
    ...(credentials.erpProvider ||
    credentials.erpBaseUrl ||
    credentials.erpApiType ||
    credentials.erpDb ||
    credentials.erpUsername ||
    credentials.erpPassword ||
    credentials.erpApiKey
      ? {
          erpSettings: {
            ...(credentials.erpProvider && {
              provider: credentials.erpProvider,
            }),
            ...(credentials.erpBaseUrl && { baseUrl: credentials.erpBaseUrl }),
            ...(credentials.erpApiType && { apiType: credentials.erpApiType }),
            ...(credentials.erpDb && { db: credentials.erpDb }),
            ...(credentials.erpUsername && {
              username: credentials.erpUsername,
            }),
            ...(credentials.erpPassword && {
              password: credentials.erpPassword,
            }),
            ...(credentials.erpApiKey && { apiKey: credentials.erpApiKey }),
          },
        }
      : {}),
    ...(credentials.dbUrl && { dbUrl: credentials.dbUrl }),
    ...(credentials.dbKey && { dbKey: credentials.dbKey }),
  };
}

async function bootstrapCredentialSession(
  credentials: EphemeralCredentials,
): Promise<void> {
  const baseUrl = getApiUrl();
  const url = new URL("/api/auth/credential-session/bootstrap", baseUrl);
  const body = buildCredentialBootstrapBody(credentials);

  const headers: Record<string, string> = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "include",
      });
    } else {
      await handleUnauthorizedAfterRetry();
    }
  }

  await throwIfResNotOk(res);

  const headerToken = res.headers.get("x-session-token");
  const payload = (await res.json()) as {
    sessionToken?: string;
    expiresInSec?: number;
  };

  const token = payload.sessionToken || headerToken;
  if (!token) {
    throw new Error("Credential session bootstrap failed: missing token");
  }

  const ttlMs =
    typeof payload.expiresInSec === "number" && payload.expiresInSec > 0
      ? payload.expiresInSec * 1000
      : CREDENTIAL_SESSION_DEFAULT_TTL_MS;

  cachedSessionToken = token;
  cachedSessionTokenExpiresAt = Date.now() + ttlMs;
  cachedAuthTokenForCredentialSession = useAuthStore
    .getState()
    .getAccessToken();
}

async function getServerPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const baseUrl = getApiUrl();
  const res = await fetch(new URL("/api/auth/public-key", baseUrl));
  if (!res.ok) {
    throw new Error("Failed to fetch server public key");
  }
  const { publicKey } = (await res.json()) as { publicKey: string };
  cachedPublicKey = publicKey;
  return publicKey;
}

export async function secureApiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
  credentialsOverride?: EphemeralCredentials,
): Promise<Response> {
  invalidateCredentialSessionIfAuthChanged();

  const baseUrl = getApiUrl();
  const url = new URL(normalizeApiRoute(route), baseUrl);

  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const hasSensitiveCredentials =
    !!credentialsOverride && hasSensitiveCredentialValues(credentialsOverride);
  const credentialFingerprint = credentialsOverride
    ? stableCredentialFingerprint(credentialsOverride)
    : null;
  let usedDirectJwe = false;

  if (credentialsOverride && hasSensitiveCredentials) {
    const isSameCredentialSession =
      hasUsableCredentialSessionToken() &&
      credentialFingerprint === cachedCredentialFingerprint;

    if (isSameCredentialSession && cachedSessionToken) {
      headers["x-session-token"] = cachedSessionToken;
    } else if (ENABLE_DIRECT_JWE) {
      try {
        const pub = await getServerPublicKey();
        const jwe = await encryptCredentialsToJWE(credentialsOverride, pub);
        headers["x-encrypted-config"] = jwe;
        usedDirectJwe = true;
      } catch {
        await bootstrapCredentialSession(credentialsOverride);
        cachedCredentialFingerprint = credentialFingerprint;
        if (cachedSessionToken) {
          headers["x-session-token"] = cachedSessionToken;
        }
      }
    } else {
      await bootstrapCredentialSession(credentialsOverride);
      cachedCredentialFingerprint = credentialFingerprint;
      if (cachedSessionToken) {
        headers["x-session-token"] = cachedSessionToken;
      }
    }
  } else if (hasUsableCredentialSessionToken() && cachedSessionToken) {
    headers["x-session-token"] = cachedSessionToken;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      if (credentialsOverride && hasSensitiveCredentials && !usedDirectJwe) {
        clearCredentialSessionCache();
        await bootstrapCredentialSession(credentialsOverride);
        cachedCredentialFingerprint = credentialFingerprint;
        if (cachedSessionToken) {
          headers["x-session-token"] = cachedSessionToken;
        }
      }
      res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    } else {
      await handleUnauthorizedAfterRetry();
    }
  }

  const newSessionToken = res.headers.get("x-session-token");
  if (newSessionToken) {
    cachedSessionToken = newSessionToken;
    cachedSessionTokenExpiresAt =
      Date.now() + CREDENTIAL_SESSION_DEFAULT_TTL_MS;
    cachedAuthTokenForCredentialSession = useAuthStore
      .getState()
      .getAccessToken();
    if (credentialFingerprint) {
      cachedCredentialFingerprint = credentialFingerprint;
    }
  }

  await throwIfResNotOk(res);
  return res;
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
  const url = new URL(normalizeApiRoute(route), baseUrl);

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
    } else {
      await handleUnauthorizedAfterRetry();
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
