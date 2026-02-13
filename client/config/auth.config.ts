/**
 * Client authentication configuration
 * Centralized configuration for client-side auth behavior
 */
export const CLIENT_AUTH_CONFIG = {
  /**
   * Session timeout in milliseconds
   * Default: 5 minutes (300000ms)
   * Controls how long biometric auth session remains valid without activity
   */
  SESSION_TIMEOUT_MS: parseInt(
    process.env.EXPO_PUBLIC_SESSION_TIMEOUT_MS || "300000",
    10,
  ),

  /**
   * Biometric authentication prompt timeout in milliseconds
   * Default: 30 seconds (30000ms)
   * Maximum time user has to complete biometric authentication
   */
  BIOMETRIC_TIMEOUT_MS: parseInt(
    process.env.EXPO_PUBLIC_BIOMETRIC_TIMEOUT_MS || "30000",
    10,
  ),

  /**
   * Maximum failed biometric attempts before fallback
   * Default: 3 attempts
   * After this many failures, falls back to passcode/PIN
   */
  MAX_BIOMETRIC_ATTEMPTS: parseInt(
    process.env.EXPO_PUBLIC_MAX_BIOMETRIC_ATTEMPTS || "3",
    10,
  ),

  /**
   * Auto-lock timeout in milliseconds (when app goes to background)
   * Default: 5 seconds (5000ms)
   * How quickly to lock when app is backgrounded
   */
  AUTO_LOCK_TIMEOUT_MS: parseInt(
    process.env.EXPO_PUBLIC_AUTO_LOCK_TIMEOUT_MS || "5000",
    10,
  ),

  /**
   * Remember device duration in milliseconds
   * Default: 30 days (2592000000ms)
   * How long to remember trusted devices
   */
  REMEMBER_DEVICE_DURATION_MS: parseInt(
    process.env.EXPO_PUBLIC_REMEMBER_DEVICE_DURATION_MS || "2592000000",
    10,
  ),
} as const;
