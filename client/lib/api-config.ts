import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:5000" or "https://repl.replit.app").
 * For local run without Replit use EXPO_PUBLIC_DOMAIN=http://localhost:5000 (or http://YOUR_IP:5000 for device).
 * On Android in __DEV__, localhost is rewritten: use Metro host from Constants.expoConfig.hostUri when
 * available (physical device + Expo Go), else 10.0.2.2 (emulator), so the app can reach the host.
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  const resolveMetroHost = () => {
    const hostUri = Constants.expoConfig?.hostUri as string | undefined;
    if (hostUri && hostUri.includes(":")) {
      const metroHost = hostUri.split(":")[0];
      if (metroHost) {
        return metroHost;
      }
    }

    const manifest = Constants.manifest as
      | { debuggerHost?: string }
      | undefined;
    if (manifest?.debuggerHost && manifest.debuggerHost.includes(":")) {
      return manifest.debuggerHost.split(":")[0];
    }

    const manifest2 = Constants.manifest2 as
      | { extra?: { expoClient?: { debuggerHost?: string } } }
      | undefined;
    const debuggerHost = manifest2?.extra?.expoClient?.debuggerHost;
    if (debuggerHost && debuggerHost.includes(":")) {
      return debuggerHost.split(":")[0];
    }

    return undefined;
  };

  if (!host) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      const metroHost = resolveMetroHost();
      if (metroHost) {
        host = `http://${metroHost}:5000`;
      } else if (Platform.OS === "android") {
        host = "http://10.0.2.2:5000";
      } else {
        host = "http://localhost:5000";
      }
    }
  }

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  if (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    Platform.OS === "android" &&
    (host.includes("localhost") || host.includes("127.0.0.1"))
  ) {
    const metroHost = resolveMetroHost();
    if (metroHost && metroHost !== "localhost" && metroHost !== "127.0.0.1") {
      host = host
        .replace(/localhost/gi, metroHost)
        .replace(/127\.0\.0\.1/g, metroHost);
    } else {
      host = host
        .replace(/localhost/gi, "10.0.2.2")
        .replace(/127\.0\.0\.1/g, "10.0.2.2");
    }
  }

  const withProtocol =
    host.startsWith("http://") || host.startsWith("https://")
      ? host
      : `https://${host}`;
  const url = new URL(withProtocol);
  const href = url.href;

  return href;
}
