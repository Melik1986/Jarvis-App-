import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import type { ERPProvider } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useProtectScreen } from "@/hooks/useProtectScreen";
import { TranslationKey } from "@/i18n/translations";
import { Spacing, BorderRadius } from "@/constants/theme";
import { secureApiRequest } from "@/lib/query-client";
import type { EphemeralCredentials } from "@/lib/jwe-encryption";

type APIType = "odata" | "rest" | "graphql";

export default function ERPSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isUnlocked, isAuthenticating, authenticate } = useBiometricAuth();
  useProtectScreen();

  const { erp, setERPSettings } = useSettingsStore();

  const [provider, setProvider] = useState<ERPProvider>(erp.provider);
  const [erpUrl, setErpUrl] = useState(erp.url);
  const [erpDb, setErpDb] = useState(erp.db || "");
  const [erpUsername, setErpUsername] = useState(erp.username);
  const [erpPassword, setErpPassword] = useState(erp.password);
  const [erpApiKey, setErpApiKey] = useState(erp.apiKey);
  const [specUrl, setSpecUrl] = useState(erp.specUrl);
  const [apiType, setApiType] = useState<APIType>(erp.apiType as APIType);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    steps?: { name: string; ok: boolean; error?: string }[];
  } | null>(null);

  const apiTypes: {
    id: APIType;
    name: string;
    descriptionKey: TranslationKey;
  }[] = [
    { id: "odata", name: t("odata"), descriptionKey: "odataDesc" },
    { id: "rest", name: t("rest"), descriptionKey: "restDesc" },
    { id: "graphql", name: t("graphql"), descriptionKey: "graphqlDesc" },
  ];

  const handleSave = () => {
    setERPSettings({
      provider,
      url: erpUrl,
      db: erpDb,
      username: erpUsername,
      password: erpPassword,
      apiKey: erpApiKey,
      specUrl,
      apiType,
    });
    navigation.goBack();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await secureApiRequest(
        "POST",
        "erp/test",
        {
          erpSettings: {
            provider,
            baseUrl: erpUrl,
            db: erpDb,
            username: erpUsername,
            apiType,
            openApiSpecUrl: specUrl,
          },
        },
        {
          erpProvider: provider,
          erpBaseUrl: erpUrl,
          erpApiType: apiType,
          erpDb: erpDb || undefined,
          erpUsername: erpUsername || undefined,
          erpPassword: erpPassword || undefined,
          erpApiKey: erpApiKey || undefined,
        } as EphemeralCredentials,
      );
      const json = (await res.json()) as {
        success: boolean;
        steps?: { name: string; ok: boolean; error?: string }[];
      };
      setTestResult(json);
    } catch (e) {
      setTestResult({
        success: false,
        steps: [{ name: "request", ok: false, error: String(e) }],
      });
    } finally {
      setIsTesting(false);
    }
  };

  const providerDocsUrlByProvider: Partial<Record<ERPProvider, string>> = {
    "1c": "https://kb.1ci.com/1C_Enterprise_Platform/FAQ/Development/Integration/Publishing_standard_REST_API_for_your_infobase/",
  };

  const selectedProviderDocsUrl = providerDocsUrlByProvider[provider];
  const selectedProviderLabel = provider === "1c" ? "1C" : provider;

  const handleOpenSelectedProviderDocs = async () => {
    if (!selectedProviderDocsUrl) return;
    await Linking.openURL(selectedProviderDocsUrl);
  };

  const isDemo = provider === "demo";
  const isOdoo = provider === "odoo";
  const isSap = provider === "sap";
  const isCustom = provider === "custom";
  const showDemo = __DEV__;

  const providers: { id: ERPProvider; label: string }[] = [
    ...(showDemo ? [{ id: "demo" as const, label: "Demo" }] : []),
    { id: "1c", label: "1C:Enterprise" },
    { id: "odoo", label: "Odoo" },
    { id: "sap", label: "SAP" },
    { id: "custom", label: "Custom" },
  ];

  if (!isUnlocked) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        {isAuthenticating ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <ThemedText
              style={{ marginBottom: Spacing.lg, textAlign: "center" }}
            >
              Доступ заблокирован. Требуется подтверждение личности.
            </ThemedText>
            <Button onPress={authenticate}>Попробовать снова</Button>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      bottomOffset={20}
    >
      <View style={styles.section}>
        <View
          style={[
            styles.hintCard,
            {
              backgroundColor: theme.warning + "10",
              borderColor: theme.warning + "40",
            },
          ]}
        >
          <ThemedText style={[styles.hintText, { color: theme.warning }]}>
            ⚠️ {t("secretsWarningTitle")}
          </ThemedText>
          <ThemedText
            style={[
              styles.hintText,
              { color: theme.textSecondary, marginTop: Spacing.xs },
            ]}
          >
            {t("secretsWarningBody")}
          </ThemedText>
        </View>

        <View
          style={[
            styles.hintCard,
            {
              backgroundColor: theme.primary + "10",
              borderColor: theme.primary + "30",
            },
          ]}
        >
          <ThemedText style={[styles.hintText, { color: theme.textSecondary }]}>
            💡 {t("erpHint")}
          </ThemedText>
        </View>

        {selectedProviderDocsUrl ? (
          <Pressable
            onPress={handleOpenSelectedProviderDocs}
            style={styles.docsLinkRow}
          >
            <ThemedText style={[styles.docsLinkText, { color: theme.link }]}>
              {t("apiKeyDocs")}: {selectedProviderLabel}
            </ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            {t("mode")}
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providerRow}
          >
            {providers.map((p) => {
              const selected = p.id === provider;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.providerChip,
                    {
                      backgroundColor: selected
                        ? theme.primary
                        : theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setProvider(p.id)}
                >
                  <ThemedText style={{ color: selected ? "#fff" : theme.text }}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
          <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
            {isDemo
              ? t("erpModeHintDemo")
              : isOdoo
                ? "Odoo: требуется DB + Username + API Key (JSON-RPC)"
                : isSap
                  ? "SAP: placeholder (скоро)"
                  : isCustom
                    ? "Custom: используйте OpenAPI Spec URL"
                    : t("erpModeHint1c")}
          </ThemedText>
        </View>

        {!isDemo && (
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("systemUrl")}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="https://your-erp.com"
              placeholderTextColor={theme.textTertiary}
              value={erpUrl}
              onChangeText={setErpUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {isOdoo && (
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              Database Name
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="my_odoo_db"
              placeholderTextColor={theme.textTertiary}
              value={erpDb}
              onChangeText={setErpDb}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {!isDemo && !isCustom && (
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("username")}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder={isOdoo ? "admin" : "Администратор"}
              placeholderTextColor={theme.textTertiary}
              value={erpUsername}
              onChangeText={setErpUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {!isDemo && !isOdoo && !isCustom && !isSap && (
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("password")}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="••••••••"
              placeholderTextColor={theme.textTertiary}
              value={erpPassword}
              onChangeText={setErpPassword}
              secureTextEntry
            />
          </View>
        )}

        {isOdoo && (
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("apiKey")}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="API Key (instead of password)"
              placeholderTextColor={theme.textTertiary}
              value={erpApiKey}
              onChangeText={setErpApiKey}
              secureTextEntry
            />
            <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
              Use API Key generated in Odoo preferences
            </ThemedText>
          </View>
        )}

        {isCustom && (
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("openApiSpecUrl")}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="https://your-erp.com/swagger.json"
              placeholderTextColor={theme.textTertiary}
              value={specUrl}
              onChangeText={setSpecUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}
      </View>

      {(isCustom || isSap) && (
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            {t("apiType")}
          </ThemedText>

          <View style={styles.typeList}>
            {apiTypes.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.typeItem,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                  apiType === type.id && {
                    borderColor: theme.primary,
                    backgroundColor: theme.primary + "10",
                  },
                ]}
                onPress={() => setApiType(type.id)}
              >
                <View style={styles.typeContent}>
                  <ThemedText style={[styles.typeName, { color: theme.text }]}>
                    {type.name}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.typeDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t(type.descriptionKey)}
                  </ThemedText>
                </View>
                {apiType === type.id ? (
                  <View
                    style={[
                      styles.checkCircle,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <AnimatedCheckIcon size={16} color={theme.buttonText} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.emptyCircle,
                      { borderColor: theme.textTertiary },
                    ]}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!isDemo && (
          <View style={styles.testRow}>
            <Button onPress={handleTestConnection} disabled={isTesting}>
              {t("testConnection")}
            </Button>
            {testResult ? (
              <ThemedText
                style={[
                  styles.testStatus,
                  { color: testResult.success ? theme.success : theme.error },
                ]}
              >
                {testResult.success
                  ? t("connectionSuccess")
                  : t("connectionFailed")}
              </ThemedText>
            ) : null}
          </View>
        )}
        {testResult?.steps?.length ? (
          <View style={styles.testDetails}>
            {testResult.steps.map((s) => (
              <ThemedText
                key={s.name}
                style={[styles.hint, { color: theme.textSecondary }]}
              >
                {s.ok ? "✓" : "✗"} {s.name}
                {s.error ? `: ${s.error}` : ""}
              </ThemedText>
            ))}
          </View>
        ) : null}
        <Button onPress={handleSave}>{t("saveSettings")}</Button>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["3xl"],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  hintCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  docsLinkRow: {
    marginBottom: Spacing.lg,
  },
  docsLinkText: {
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  providerRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  providerChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  testRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  testStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  testDetails: {
    marginBottom: Spacing.lg,
  },
  textInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  typeList: {
    gap: Spacing.sm,
  },
  typeItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  typeContent: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  typeDescription: {
    fontSize: 14,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
  },
});
