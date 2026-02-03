import { useState, useEffect, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppLogger } from "@/lib/logger";

interface BiometricAuthResult {
  isUnlocked: boolean;
  isAuthenticating: boolean;
  error: string | null;
  authenticate: () => Promise<void>;
}

/**
 * Hook to require biometric authentication for a screen.
 * On web or if no biometrics are available, it unlocks immediately.
 */
export function useBiometricAuth(
  promptMessage: string = "Подтвердите личность для доступа к настройкам",
): BiometricAuthResult {
  const [isUnlocked, setIsUnlocked] = useState(Platform.OS === "web");
  const [isAuthenticating, setIsAuthenticating] = useState(
    Platform.OS !== "web",
  );
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  const authenticate = useCallback(async () => {
    if (Platform.OS === "web") {
      setIsUnlocked(true);
      setIsAuthenticating(false);
      return;
    }

    try {
      setIsAuthenticating(true);
      setError(null);

      // 1. Check if hardware supports biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setIsUnlocked(true);
        setIsAuthenticating(false);
        return;
      }

      // 2. Check if any biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setIsUnlocked(true);
        setIsAuthenticating(false);
        return;
      }

      // 3. Authenticate
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: "Использовать пароль устройства",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsUnlocked(true);
      } else {
        setError("Ошибка аутентификации");
        Alert.alert("Доступ отклонен", "Не удалось подтвердить личность", [
          {
            text: "Назад",
            onPress: () => navigation.goBack(),
            style: "cancel",
          },
          {
            text: "Попробовать снова",
            onPress: () => {
              authenticate();
            },
          },
        ]);
      }
    } catch (e) {
      AppLogger.error("Biometric authentication error:", e);
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      setIsUnlocked(true); // Fallback to allow access if error occurs in system
    } finally {
      setIsAuthenticating(false);
    }
  }, [navigation, promptMessage]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      authenticate();
    }
  }, [authenticate]);

  return { isUnlocked, isAuthenticating, error, authenticate };
}
