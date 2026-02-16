import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/store/authStore";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppLogger } from "@/lib/logger";

WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({
  scheme: "axon",
  path: "auth/callback",
});

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const colors = theme;
  const { t } = useTranslation();
  const { setUser, setSession, isLoading } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleAuthSuccess = useCallback(
    (data: {
      success: boolean;
      session?: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
      user?: { id: string; email: string; name?: string; picture?: string };
      error?: string;
    }) => {
      if (data.success && data.session && data.user) {
        setSession({
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          expiresIn: data.session.expiresIn,
          expiresAt: Date.now() + data.session.expiresIn * 1000,
        });
        setUser(data.user);
        return true;
      }
      return false;
    },
    [setSession, setUser],
  );

  const exchangeCodeForSession = useCallback(
    async (code: string) => {
      try {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}api/auth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await response.json();
        return handleAuthSuccess(data);
      } catch (error) {
        AppLogger.error("Error exchanging auth code:", error);
        return false;
      }
    },
    [handleAuthSuccess],
  );

  const extractCodeFromUrl = useCallback((url: string): string | null => {
    try {
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      return codeMatch?.[1] ? decodeURIComponent(codeMatch[1]) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const code = extractCodeFromUrl(event.url);
      if (code) {
        setIsSigningIn(true);
        await exchangeCodeForSession(code);
        setIsSigningIn(false);
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [exchangeCodeForSession, extractCodeFromUrl]);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t("error"), "Email and password are required");
      return;
    }

    if (isRegisterMode && password.length < 6) {
      Alert.alert(t("error"), "Password must be at least 6 characters");
      return;
    }

    setIsSigningIn(true);

    try {
      const baseUrl = getApiUrl();
      const endpoint = isRegisterMode ? "register" : "login";
      const body: Record<string, string> = { email: email.trim(), password };

      if (isRegisterMode && name.trim()) {
        body.name = name.trim();
      }

      const response = await fetch(`${baseUrl}api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!handleAuthSuccess(data)) {
        const errorMsg = data.message || data.error || t("authFailed");
        Alert.alert(t("error"), errorMsg);
      }
    } catch (error) {
      AppLogger.error("Email auth error:", error);
      Alert.alert(t("error"), t("authFailed"));
    }

    setIsSigningIn(false);
  };

  const handleReplitLogin = async () => {
    setIsSigningIn(true);

    try {
      const baseUrl = getApiUrl();
      const loginUrl = `${baseUrl}api/auth/login?redirect=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        redirectUri,
        { preferEphemeralSession: Platform.OS === "ios" },
      );

      if (result.type === "success" && result.url) {
        const code = extractCodeFromUrl(result.url);
        if (code) {
          await exchangeCodeForSession(code);
        }
      }
    } catch (error) {
      AppLogger.error("Replit login error:", error);
    }

    setIsSigningIn(false);
  };

  const loading = isLoading || isSigningIn;

  const inputStyle = [
    styles.input,
    {
      color: colors.text,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    },
  ];

  return (
    <LinearGradient
      colors={
        isDark
          ? ["#0A0E1A", "#1A1F2E", "#0A0E1A"]
          : ["#F8FAFC", "#E2E8F0", "#F8FAFC"]
      }
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Image
                source={require("../../assets/images/icon.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>AXON</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("appTagline")}
            </Text>
          </View>

          <View style={styles.form}>
            {isRegisterMode && (
              <TextInput
                style={inputStyle}
                placeholder={t("namePlaceholder")}
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            )}

            <TextInput
              style={inputStyle}
              placeholder={t("emailPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                placeholder={t("passwordPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete={isRegisterMode ? "new-password" : "password"}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                { opacity: pressed ? 0.8 : 1, backgroundColor: colors.primary },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleEmailAuth}
              disabled={loading}
              testID="button-email-auth"
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather
                    name={isRegisterMode ? "user-plus" : "log-in"}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.buttonText}>
                    {isRegisterMode ? t("signUp") : t("signIn")}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => setIsRegisterMode(!isRegisterMode)}
              style={styles.toggleMode}
            >
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {isRegisterMode ? t("haveAccount") : t("noAccount")}{" "}
                <Text style={styles.toggleTextBold}>
                  {isRegisterMode ? t("signIn") : t("signUp")}
                </Text>
              </Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
              or
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.altButton,
                { opacity: pressed ? 0.8 : 1, borderColor: colors.border },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleReplitLogin}
              disabled={loading}
              testID="button-replit-login"
            >
              <Feather name="box" size={18} color={colors.textSecondary} />
              <Text
                style={[styles.altButtonText, { color: colors.textSecondary }]}
              >
                Sign in with Replit
              </Text>
            </Pressable>

            <Text style={[styles.termsText, { color: colors.textSecondary }]}>
              {t("termsAgreement")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
    gap: Spacing.xl,
  },
  header: {
    alignItems: "center",
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
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
  form: {
    gap: Spacing.md,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: 16,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  toggleMode: {
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  toggleText: {
    fontSize: 14,
  },
  toggleTextBold: {
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  altButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  altButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
});
