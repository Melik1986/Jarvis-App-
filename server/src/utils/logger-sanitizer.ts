import fastRedact from "fast-redact";

const redact = fastRedact({
  paths: [
    "*.apiKey",
    "*.password",
    "*.secret",
    "*.token",
    "*.authorization",
    "headers.authorization",
    "headers['x-llm-key']",
    "headers['x-db-key']",
    "headers['x-encrypted-config']",
    "headers['x-session-token']",
    "ephemeralCredentials",
    "*.llmKey",
    "*.dbKey",
    "*.erpUrl",
    "*.erpUsername",
  ],
  censor: "[REDACTED]",
  serialize: false,
});

function safeClone(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => safeClone(item, seen));
  }
  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    output[key] = safeClone(val, seen);
  }
  return output;
}

/**
 * Sanitizes sensitive data from log entries using fast-redact.
 * Handles circular references and large objects safely.
 */
export function sanitizeForLogging(obj: unknown): unknown {
  try {
    return redact(obj);
  } catch {
    try {
      return redact(safeClone(obj));
    } catch {
      return { error: "Failed to sanitize log entry" };
    }
  }
}
