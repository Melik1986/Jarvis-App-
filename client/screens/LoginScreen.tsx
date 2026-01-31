import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/store/authStore";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const colors = theme;
  const { t } = useTranslation();
  const { setUser, setSession, isLoading } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      handleAuthCallback(event.url);
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthCallback(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAuthCallback = async (url: string) => {
    if (!url.includes("/auth/success")) return;

    try {
      const urlObj = new URL(url);
      const accessToken = urlObj.searchParams.get("accessToken");
      const refreshToken = urlObj.searchParams.get("refreshToken");
      const expiresIn = urlObj.searchParams.get("expiresIn");
      const userJson = urlObj.searchParams.get("user");

      if (accessToken && refreshToken && expiresIn) {
        const session = {
          accessToken,
          refreshToken,
          expiresIn: parseInt(expiresIn, 10),
          expiresAt: Date.now() + parseInt(expiresIn, 10) * 1000,
        };
        setSession(session);

        if (userJson) {
          const user = JSON.parse(decodeURIComponent(userJson));
          setUser(user);
        }
      }
    } catch (error) {
      console.error("Error handling auth callback:", error);
    }
    setIsSigningIn(false);
  };

  const handleLogin = async () => {
    setIsSigningIn(true);

    try {
      const baseUrl = getApiUrl();
      const redirectUri = Linking.createURL("/auth/success");
      const loginUrl = `${baseUrl}api/auth/login?redirect=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        redirectUri,
      );

      if (result.type === "success" && result.url) {
        await handleAuthCallback(result.url);
      } else {
        setIsSigningIn(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert(t("error"), t("authFailed"));
      setIsSigningIn(false);
    }
  };

  const handleDevLogin = async () => {
    setIsSigningIn(true);
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "dev@axon.local", name: "Dev User" }),
      });

      const data = await response.json();

      if (data.success && data.session && data.user) {
        setSession({
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          expiresIn: data.session.expiresIn,
          expiresAt: Date.now() + data.session.expiresIn * 1000,
        });
        setUser(data.user);
      } else {
        Alert.alert(t("error"), data.error || t("authFailed"));
      }
    } catch (error) {
      console.error("Dev login error:", error);
      Alert.alert(t("error"), t("authFailed"));
    }
    setIsSigningIn(false);
  };

  const loading = isLoading || isSigningIn;
  const isDev = __DEV__;

  return (
    <LinearGradient
      colors={
        isDark
          ? ["#0A0E1A", "#1A1F2E", "#0A0E1A"]
          : ["#F8FAFC", "#E2E8F0", "#F8FAFC"]
      }
      style={styles.container}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.logoContainer,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Feather name="cpu" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>AXON</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t("appTagline")}
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureItem
            icon="message-circle"
            title={t("smartAssistant")}
            description={t("smartAssistantDesc")}
            colors={colors}
          />
          <FeatureItem
            icon="mic"
            title={t("voiceCommands")}
            description={t("voiceCommandsDesc")}
            colors={colors}
          />
          <FeatureItem
            icon="database"
            title={t("erpIntegration")}
            description={t("erpIntegrationDesc")}
            colors={colors}
          />
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              { opacity: pressed ? 0.8 : 1, backgroundColor: colors.primary },
              loading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            testID="button-login"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="log-in" size={20} color="#FFF" />
                <Text style={styles.buttonText}>{t("signIn")}</Text>
              </>
            )}
          </Pressable>

          {isDev ? (
            <Pressable
              style={({ pressed }) => [
                styles.devButton,
                { opacity: pressed ? 0.8 : 1, borderColor: colors.border },
              ]}
              onPress={handleDevLogin}
              disabled={loading}
              testID="button-dev-signin"
            >
              <Feather name="code" size={18} color={colors.textSecondary} />
              <Text
                style={[styles.devButtonText, { color: colors.textSecondary }]}
              >
                Continue as Dev User
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.termsText, { color: colors.textSecondary }]}>
            {t("termsAgreement")}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function FeatureItem({
  icon,
  title,
  description,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  colors: any;
}) {
  return (
    <View style={styles.featureItem}>
      <View
        style={[styles.featureIcon, { backgroundColor: colors.primary + "15" }]}
      >
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text
          style={[styles.featureDescription, { color: colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 4,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    maxWidth: 280,
  },
  features: {
    gap: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  devButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  devButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
});
