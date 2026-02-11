import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { StateStorage } from "zustand/middleware";
import { AppLogger } from "./logger";
import { AuditService } from "./audit-logger";

/**
 * List of standard sensitive paths (LLM, RAG) - Stored with WHEN_UNLOCKED
 */
export const SETTINGS_STD_PATHS = [
  "llm.baseUrl",
  "llm.apiKey",
  "llm.userInstructions",
  "rag.qdrant.url",
  "rag.qdrant.apiKey",
  "rag.supabase.url",
  "rag.supabase.apiKey",
];

/**
 * List of high security paths (ERP) - Stored with requireAuthentication (if supported)
 */
export const SETTINGS_HIGH_SEC_PATHS = [
  "erp.url",
  "erp.apiKey",
  "erp.username",
  "erp.password",
  "erp.specUrl",
];

/**
 * Combined list for backward compatibility or general usage
 */
export const SETTINGS_SENSITIVE_PATHS = [
  ...SETTINGS_STD_PATHS,
  ...SETTINGS_HIGH_SEC_PATHS,
];

export const AUTH_SENSITIVE_PATHS = ["session"];

/**
 * Helper to get nested value from object
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Helper to set nested value in object (mutates object)
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  const lastPart = parts.pop()!;
  const target = parts.reduce((acc: Record<string, unknown>, part) => {
    if (!acc[part] || typeof acc[part] !== "object") {
      acc[part] = {};
    }
    return acc[part] as Record<string, unknown>;
  }, obj);
  target[lastPart] = value;
}

/**
 * Helper to remove nested value (sets to empty string)
 */
function clearNestedValue(obj: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  const lastPart = parts.pop()!;
  const target = parts.reduce((acc: unknown, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);

  if (target && typeof target === "object") {
    (target as Record<string, unknown>)[lastPart] = "";
  }
}

/**
 * Creates a hybrid storage that stores sensitive fields in SecureStore and others in AsyncStorage.
 * Implements Strict Migration and Tiered Security.
 */
export function createHybridStorage(
  storageName: string,
  stdPaths: string[],
  secureKey: string,
  highSecPaths: string[] = [],
  highSecKey: string = "",
): StateStorage {
  const isWeb = Platform.OS === "web";
  const migrationKey = `${storageName}-migration-v1-done`;

  return {
    getItem: async (name: string): Promise<string | null> => {
      // 1. Get public data from AsyncStorage
      const publicDataStr = await AsyncStorage.getItem(name);
      if (!publicDataStr) return null;

      let state: Record<string, unknown>;
      try {
        state = JSON.parse(publicDataStr);
      } catch {
        return publicDataStr;
      }

      const actualState = (state.state as Record<string, unknown>) || state;

      if (isWeb) {
        return publicDataStr;
      }

      // 2. Check Migration Status
      const migrationDone = await AsyncStorage.getItem(migrationKey);

      if (!migrationDone) {
        // --- STRICT MIGRATION LOGIC ---
        AppLogger.info(`Starting strict migration for ${storageName}`);

        // Extract secrets from AsyncStorage state
        const stdSecrets: Record<string, unknown> = {};
        const highSecrets: Record<string, unknown> = {};

        stdPaths.forEach((path) => {
          const val = getNestedValue(actualState, path);
          if (val && val !== "") {
            stdSecrets[path] = val;
          }
        });

        highSecPaths.forEach((path) => {
          const val = getNestedValue(actualState, path);
          if (val && val !== "") {
            highSecrets[path] = val;
          }
        });

        // Write to SecureStore
        if (Object.keys(stdSecrets).length > 0) {
          await SecureStore.setItemAsync(
            secureKey,
            JSON.stringify(stdSecrets),
            { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
          );
        }

        if (Object.keys(highSecrets).length > 0 && highSecKey) {
          await SecureStore.setItemAsync(
            highSecKey,
            JSON.stringify(highSecrets),
            {
              keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
              // requireAuthentication: true, // Tiered Security - Removed to avoid double prompt
            },
          );
        }

        // CRITICAL: Clear secrets from public state
        [...stdPaths, ...highSecPaths].forEach((path) =>
          clearNestedValue(actualState, path),
        );

        // Write cleaned state back to AsyncStorage
        await AsyncStorage.setItem(name, JSON.stringify(state));

        // Set migration flag
        await AsyncStorage.setItem(migrationKey, "true");
        await AuditService.logEvent(
          "MIGRATION_SUCCESS",
          `Migrated ${storageName}`,
        );
        AppLogger.info(`Strict migration completed for ${storageName}`);
      }

      // 3. Load Secrets from SecureStore
      // Standard Secrets
      const stdDataStr = await SecureStore.getItemAsync(secureKey);
      if (stdDataStr) {
        try {
          const stdData = JSON.parse(stdDataStr);
          Object.entries(stdData).forEach(([path, value]) => {
            setNestedValue(actualState, path, value);
          });
        } catch (e) {
          AppLogger.error(`Failed to parse std secure data`, e);
        }
      }

      // High Security Secrets
      if (highSecKey) {
        try {
          // specific options for retrieval might be needed depending on platform,
          // but getItemAsync usually prompts if requireAuthentication was used on set
          const highDataStr = await SecureStore.getItemAsync(highSecKey);
          // Removed requireAuthentication: true to avoid double prompt
          if (highDataStr) {
            const highData = JSON.parse(highDataStr);
            Object.entries(highData).forEach(([path, value]) => {
              setNestedValue(actualState, path, value);
            });
          }
        } catch (e) {
          // If user cancels auth or it fails, we just don't load these secrets
          // The app should handle missing credentials gracefully (e.g. ask to re-login to ERP)
          AppLogger.warn(`Could not load high security data: ${e}`);
          await AuditService.logEvent(
            "SECURE_STORE_ERROR",
            "Failed to load high security keys",
          );
        }
      }

      return JSON.stringify(state);
    },

    setItem: async (name: string, value: string): Promise<void> => {
      let state: Record<string, unknown>;
      try {
        state = JSON.parse(value);
      } catch {
        await AsyncStorage.setItem(name, value);
        return;
      }

      const actualState = (state.state as Record<string, unknown>) || state;

      if (isWeb) {
        await AsyncStorage.setItem(name, value);
        return;
      }

      // 1. Extract sensitive data
      const stdSecrets: Record<string, unknown> = {};
      const highSecrets: Record<string, unknown> = {};

      stdPaths.forEach((path) => {
        const val = getNestedValue(actualState, path);
        if (val !== undefined) {
          stdSecrets[path] = val;
          clearNestedValue(actualState, path);
        }
      });

      highSecPaths.forEach((path) => {
        const val = getNestedValue(actualState, path);
        if (val !== undefined) {
          highSecrets[path] = val;
          clearNestedValue(actualState, path);
        }
      });

      // 2. Save public data
      await AsyncStorage.setItem(name, JSON.stringify(state));

      // 3. Save secure data
      if (Object.keys(stdSecrets).length > 0) {
        await SecureStore.setItemAsync(secureKey, JSON.stringify(stdSecrets), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }

      if (Object.keys(highSecrets).length > 0 && highSecKey) {
        await SecureStore.setItemAsync(
          highSecKey,
          JSON.stringify(highSecrets),
          {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            // requireAuthentication: true,
          },
        );
      }
    },

    removeItem: async (name: string): Promise<void> => {
      await AsyncStorage.removeItem(name);
      await AsyncStorage.removeItem(migrationKey);
      if (!isWeb) {
        await SecureStore.deleteItemAsync(secureKey);
        if (highSecKey) {
          await SecureStore.deleteItemAsync(highSecKey);
        }
      }
    },
  };
}
