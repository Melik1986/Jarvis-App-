export const REQUEST_SIGNATURE_HEADERS = {
  signature: "x-signature",
  timestamp: "x-signature-ts",
  nonce: "x-signature-nonce",
  algorithm: "x-signature-alg",
} as const;

export const REQUEST_SIGNATURE_ALGORITHM = "hmac-sha256-v1";

function toCanonicalQuery(pathOrUrl: URL): string {
  const entries = Array.from(pathOrUrl.searchParams.entries()).sort((a, b) => {
    const keyCmp = a[0].localeCompare(b[0]);
    if (keyCmp !== 0) return keyCmp;
    return a[1].localeCompare(b[1]);
  });

  if (entries.length === 0) {
    return "";
  }

  const query = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  return `?${query}`;
}

export function normalizePathForSignature(pathOrUrl: string): string {
  try {
    const parsed =
      pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
        ? new URL(pathOrUrl)
        : new URL(pathOrUrl, "http://localhost");
    const pathname = parsed.pathname || "/";
    return `${pathname}${toCanonicalQuery(parsed)}`;
  } catch {
    const noFragment = pathOrUrl.split("#")[0] || "/";
    return noFragment.startsWith("/") ? noFragment : `/${noFragment}`;
  }
}

export function canonicalStringify(value: unknown): string {
  if (value === null) {
    return JSON.stringify(value);
  }

  if (value === undefined) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined ? "null" : canonicalStringify(item)))
      .join(",")}]`;
  }

  const sortedKeys = Object.keys(value as Record<string, unknown>).sort(
    (a, b) => a.localeCompare(b),
  );

  const pairs: string[] = [];
  for (const key of sortedKeys) {
    const nested = (value as Record<string, unknown>)[key];
    if (nested === undefined) {
      continue;
    }
    pairs.push(`${JSON.stringify(key)}:${canonicalStringify(nested)}`);
  }

  return `{${pairs.join(",")}}`;
}

function normalizeBodyForSignature(body: unknown): unknown {
  const source = body ?? {};
  try {
    return JSON.parse(JSON.stringify(source)) as unknown;
  } catch {
    return source;
  }
}

export function buildCanonicalSignaturePayload(params: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: unknown;
}): string {
  const method = params.method.toUpperCase();
  const path = normalizePathForSignature(params.path);
  const body = canonicalStringify(normalizeBodyForSignature(params.body));

  return [method, path, params.timestamp, params.nonce, body].join("\n");
}
