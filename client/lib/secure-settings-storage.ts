import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { StateStorage } from "zustand/middleware";
import { AppLogger } from "./logger";

/**
 * List of sensitive paths in the settings store that should be stored in SecureStore.
 * Format: 'parent.child' or 'parent.child.grandchild'
 */
export const SETTINGS_SENSITIVE_PATHS = [
  "llm.baseUrl",
  "llm.apiKey",
  "erp.url",
  "erp.apiKey",
  "erp.username",
  "erp.password",
  "erp.specUrl",
  "rag.qdrant.url",
  "rag.qdrant.apiKey",
  "rag.supabase.url",
  "rag.supabase.apiKey",
];

/**
 * List of sensitive paths in the auth store.
 */
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
 * Helper to remove nested value (sets to empty string or null)
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
 *
 * @param storageName The name of the storage (key in AsyncStorage)
 * @param sensitivePaths Array of dot-notated paths to sensitive fields
 * @param secureKey The key to use in SecureStore
 */
export function createHybridStorage(
  storageName: string,
  sensitivePaths: string[],
  secureKey: string,
): StateStorage {
  const isWeb = Platform.OS === "web";

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

      // If state doesn't have version/state wrapper (Zustand persist format), handle it
      const actualState = (state.state as Record<string, unknown>) || state;

      if (isWeb) {
        return publicDataStr;
      }

      // 2. Get sensitive data from SecureStore
      const secureDataStr = await SecureStore.getItemAsync(secureKey);
      let secureData: Record<string, unknown> = {};

      if (secureDataStr) {
        try {
          secureData = JSON.parse(secureDataStr);
        } catch {
          AppLogger.error(`Failed to parse secure data for ${secureKey}`);
        }
      } else {
        // 3. Migration logic: Check if secrets are in AsyncStorage but not in SecureStore
        const newSecureData: Record<string, unknown> = {};
        let foundAnySecret = false;
        sensitivePaths.forEach((path) => {
          const val = getNestedValue(actualState, path);
          if (val && val !== "") {
            newSecureData[path] = val;
            foundAnySecret = true;
          }
        });

        if (foundAnySecret) {
          secureData = newSecureData;
          // Store secrets in SecureStore
          await SecureStore.setItemAsync(
            secureKey,
            JSON.stringify(secureData),
            {
              keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            },
          );

          // Clean up AsyncStorage (optional but recommended)
          sensitivePaths.forEach((path) => clearNestedValue(actualState, path));
          await AsyncStorage.setItem(name, JSON.stringify(state));
        }
      }

      // 4. Merge secure data back into state
      Object.entries(secureData).forEach(([path, value]) => {
        setNestedValue(actualState, path, value);
      });

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
      const secureData: Record<string, unknown> = {};
      sensitivePaths.forEach((path) => {
        const val = getNestedValue(actualState, path);
        if (val !== undefined) {
          secureData[path] = val;
          // Clear it from the public state
          clearNestedValue(actualState, path);
        }
      });

      // 2. Save public data to AsyncStorage
      await AsyncStorage.setItem(name, JSON.stringify(state));

      // 3. Save sensitive data to SecureStore
      if (Object.keys(secureData).length > 0) {
        await SecureStore.setItemAsync(secureKey, JSON.stringify(secureData), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
    },

    removeItem: async (name: string): Promise<void> => {
      await AsyncStorage.removeItem(name);
      if (!isWeb) {
        await SecureStore.deleteItemAsync(secureKey);
      }
    },
  };
}
