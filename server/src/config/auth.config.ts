/**
 * Authentication configuration
 * Centralized configuration for auth service behavior
 */
export const AUTH_CONFIG = {
  /**
   * Time-to-live for temporary authentication codes in milliseconds
   * Default: 60 seconds (60000ms)
   * Should be short enough to prevent replay attacks but long enough for user to complete auth
   */
  TEMP_CODE_TTL_MS: parseInt(process.env.AUTH_TEMP_CODE_TTL_MS || "60000", 10),

  /**
   * Access token expiry time
   * Default: 24 hours
   * Controls how long access tokens remain valid
   */
  ACCESS_TOKEN_EXPIRY: process.env.AUTH_ACCESS_TOKEN_EXPIRY || "24h",

  /**
   * Refresh token expiry time
   * Default: 30 days
   * Controls how long refresh tokens remain valid
   */
  REFRESH_TOKEN_EXPIRY: process.env.AUTH_REFRESH_TOKEN_EXPIRY || "30d",

  /**
   * Session timeout in milliseconds
   * Default: 30 minutes (1800000ms)
   * Controls how long user sessions remain active without activity
   */
  SESSION_TIMEOUT_MS: parseInt(
    process.env.AUTH_SESSION_TIMEOUT_MS || "1800000",
    10,
  ),

  /**
   * Maximum failed login attempts before temporary lockout
   * Default: 5 attempts
   * Helps prevent brute force attacks
   */
  MAX_FAILED_ATTEMPTS: parseInt(
    process.env.AUTH_MAX_FAILED_ATTEMPTS || "5",
    10,
  ),

  /**
   * Lockout duration after max failed attempts in milliseconds
   * Default: 15 minutes (900000ms)
   * Time user must wait before attempting login again after lockout
   */
  LOCKOUT_DURATION_MS: parseInt(
    process.env.AUTH_LOCKOUT_DURATION_MS || "900000",
    10,
  ),
} as const;
