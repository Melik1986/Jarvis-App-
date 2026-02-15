import { QueryClient, QueryFunction } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { getApiUrl } from "@/lib/api-config";
import { useAuthStore } from "@/store/authStore";
import { extractErrorFromResponse } from "@/lib/error-handler";
import {
  encryptCredentialsToJWE,
  EphemeralCredentials,
} from "@/lib/jwe-encryption";
import {
  REQUEST_SIGNATURE_ALGORITHM,
  REQUEST_SIGNATURE_HEADERS,
  buildCanonicalSignaturePayload,
} from "@shared/security/request-signature";

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
const SIGNATURE_NONCE_BYTES = 16;
const PROTECTED_MUTATING_ROUTE_PATTERNS: RegExp[] = [
  /^\/api\/chat$/,
  /^\/api\/voice\/message$/,
  /^\/api\/erp\/test$/,
  /^\/api\/conductor\/parse$/,
  /^\/api\/documents\/upload-url$/,
  /^\/api\/mcp\/servers$/,
];

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

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data as unknown as BufferSource,
  );
  return new Uint8Array(digest);
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const blockSize = 64;
  let normalizedKey = utf8(key);

  if (normalizedKey.length > blockSize) {
    normalizedKey = await sha256(normalizedKey);
  }

  if (normalizedKey.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(normalizedKey);
    normalizedKey = padded;
  }

  const oPad = new Uint8Array(blockSize);
  const iPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    const keyByte = normalizedKey[i] ?? 0;
    oPad[i] = keyByte ^ 0x5c;
    iPad[i] = keyByte ^ 0x36;
  }

  const inner = await sha256(concatBytes(iPad, utf8(message)));
  const outer = await sha256(concatBytes(oPad, inner));
  return bytesToHex(outer);
}

async function deriveJweSharedSecret(accessToken: string): Promise<Uint8Array> {
  return sha256(utf8(`axon-jwe:${accessToken}`));
}

function shouldSignRequest(method: string, url: URL): boolean {
  const normalizedMethod = method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    return false;
  }
  return PROTECTED_MUTATING_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(url.pathname),
  );
}

async function applyRequestSignature(
  headers: Record<string, string>,
  method: string,
  url: URL,
  body: unknown,
): Promise<Record<string, string>> {
  if (!shouldSignRequest(method, url)) {
    return headers;
  }

  const accessToken = useAuthStore.getState().getAccessToken();
  if (!accessToken) {
    throw new Error(
      "SECURE_TRANSPORT_UNAVAILABLE: Missing access token for request signature",
    );
  }

  const timestamp = String(Date.now());
  const nonce = bytesToHex(Crypto.getRandomBytes(SIGNATURE_NONCE_BYTES));
  const canonicalPayload = buildCanonicalSignaturePayload({
    method,
    path: `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    body: body ?? {},
  });
  const signature = await hmacSha256Hex(accessToken, canonicalPayload);

  return {
    ...headers,
    [REQUEST_SIGNATURE_HEADERS.algorithm]: REQUEST_SIGNATURE_ALGORITHM,
    [REQUEST_SIGNATURE_HEADERS.timestamp]: timestamp,
    [REQUEST_SIGNATURE_HEADERS.nonce]: nonce,
    [REQUEST_SIGNATURE_HEADERS.signature]: signature,
  };
}

// ---------------------------------------------------------------------------
// secureApiRequest — JSON with JWE transport for secrets + session token
// ---------------------------------------------------------------------------

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

export async function secureApiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
  credentialsOverride?: EphemeralCredentials,
): Promise<Response> {
  invalidateCredentialSessionIfAuthChanged();

  const baseUrl = getApiUrl();
  const url = new URL(normalizeApiRoute(route), baseUrl);
  const normalizedMethod = method.toUpperCase();

  const baseHeaders: Record<string, string> = {
    ...authHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const hasSensitiveCredentials =
    !!credentialsOverride && hasSensitiveCredentialValues(credentialsOverride);
  const credentialFingerprint = credentialsOverride
    ? stableCredentialFingerprint(credentialsOverride)
    : null;

  const buildHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { ...baseHeaders };

    if (credentialsOverride && hasSensitiveCredentials) {
      const isSameCredentialSession =
        hasUsableCredentialSessionToken() &&
        credentialFingerprint === cachedCredentialFingerprint;

      if (isSameCredentialSession && cachedSessionToken) {
        headers["x-session-token"] = cachedSessionToken;
      } else {
        const accessToken = useAuthStore.getState().getAccessToken();
        if (!accessToken) {
          throw new Error(
            "SECURE_TRANSPORT_UNAVAILABLE: Missing access token for JWE transport",
          );
        }
        const sharedSecretKey = await deriveJweSharedSecret(accessToken);

        try {
          headers["x-encrypted-config"] = await encryptCredentialsToJWE(
            credentialsOverride,
            {
              sharedSecretKey,
            },
            {
              preferredAlgorithm: "dir",
              supportedAlgorithms: ["dir"],
            },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `SECURE_TRANSPORT_UNAVAILABLE: Failed to encrypt credentials (${message})`,
          );
        }
      }
    } else if (hasUsableCredentialSessionToken() && cachedSessionToken) {
      headers["x-session-token"] = cachedSessionToken;
    }

    return applyRequestSignature(headers, normalizedMethod, url, data);
  };

  let headers = await buildHeaders();
  const requestUsedSessionToken = (): boolean =>
    Boolean(headers["x-session-token"]);

  let res = await fetch(url, {
    method: normalizedMethod,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Server-side credential sessions are in-memory. After server restart,
  // a stale x-session-token should trigger one transparent retry with fresh JWE.
  if (res.status === 401 && requestUsedSessionToken()) {
    clearCredentialSessionCache();
    headers = await buildHeaders();
    res = await fetch(url, {
      method: normalizedMethod,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  }

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      baseHeaders["Authorization"] = `Bearer ${newToken}`;
      if (credentialsOverride && hasSensitiveCredentials) {
        clearCredentialSessionCache();
      } else if (requestUsedSessionToken()) {
        clearCredentialSessionCache();
      }
      headers = await buildHeaders();
      res = await fetch(url, {
        method: normalizedMethod,
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
  const normalizedMethod = method.toUpperCase();

  const baseHeaders: Record<string, string> = {
    ...authHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  let headers = await applyRequestSignature(
    baseHeaders,
    normalizedMethod,
    url,
    data,
  );

  let res = await fetch(url, {
    method: normalizedMethod,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      baseHeaders["Authorization"] = `Bearer ${newToken}`;
      headers = await applyRequestSignature(
        baseHeaders,
        normalizedMethod,
        url,
        data,
      );
      res = await fetch(url, {
        method: normalizedMethod,
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
