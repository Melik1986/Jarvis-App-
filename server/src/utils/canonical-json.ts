/**
 * Canonical JSON stringification with sorted keys.
 * Ensures consistent ordering for HMAC signature validation.
 */
export function canonicalStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  // Sort keys and recursively stringify
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalStringify(value)}`;
  });

  return `{${pairs.join(",")}}`;
}
