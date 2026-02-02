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
  ],
  censor: "[REDACTED]",
  serialize: false,
});

/**
 * Sanitizes sensitive data from log entries using fast-redact.
 * Handles circular references and large objects safely.
 */
export function sanitizeForLogging(obj: unknown): unknown {
  try {
    return redact(obj);
  } catch (error) {
    // Fallback: return empty object if redact fails (avoid circular dependency)
    // eslint-disable-next-line no-console
    console.warn("[LoggerSanitizer] Failed to sanitize log entry:", error);
    return { error: "Failed to sanitize log entry" };
  }
}
