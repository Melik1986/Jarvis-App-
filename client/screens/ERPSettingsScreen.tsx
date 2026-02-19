import React, { useReducer } from "react";
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

type FormState = {
  provider: ERPProvider;
  erpUrl: string;
  erpDb: string;
  erpUsername: string;
  erpPassword: string;
  erpApiKey: string;
  specUrl: string;
  apiType: APIType;
  isTesting: boolean;
  testResult: {
    success: boolean;
    steps?: { name: string; ok: boolean; error?: string }[];
  } | null;
};

function formReducer(prev: FormState, next: Partial<FormState>): FormState {
  return { ...prev, ...next };
}

type SharedFormProps = {
  form: FormState;
  updateForm: (next: Partial<FormState>) => void;
  theme: ReturnType<typeof useTheme>["theme"];
  t: ReturnType<typeof useTranslation>["t"];
};

function ERPProviderSelector({
  form,
  updateForm,
  theme,
  t,
  providers,
}: SharedFormProps & { providers: { id: ERPProvider; label: string }[] }) {
  const isDemo = form.provider === "demo";
  const isOdoo = form.provider === "odoo";
  const isSap = form.provider === "sap";
  const isCustom = form.provider === "custom";

  return (
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
          const selected = p.id === form.provider;
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
              onPress={() => updateForm({ provider: p.id })}
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
  );
}

function ERPCredentialsForm({ form, updateForm, theme, t }: SharedFormProps) {
  const isDemo = form.provider === "demo";
  const isOdoo = form.provider === "odoo";
  const isSap = form.provider === "sap";
  const isCustom = form.provider === "custom";

  return (
    <>
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
            value={form.erpUrl}
            onChangeText={(v) => updateForm({ erpUrl: v })}
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
            value={form.erpDb}
            onChangeText={(v) => updateForm({ erpDb: v })}
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
            value={form.erpUsername}
            onChangeText={(v) => updateForm({ erpUsername: v })}
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
            value={form.erpPassword}
            onChangeText={(v) => updateForm({ erpPassword: v })}
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
            value={form.erpApiKey}
            onChangeText={(v) => updateForm({ erpApiKey: v })}
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
            value={form.specUrl}
            onChangeText={(v) => updateForm({ specUrl: v })}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}
    </>
  );
}

function TestConnectionResult({
  form,
  theme,
  t,
  onTestConnection,
}: SharedFormProps & { onTestConnection: () => void }) {
  const isDemo = form.provider === "demo";

  return (
    <>
      {!isDemo && (
        <View style={styles.testRow}>
          <Button onPress={onTestConnection} disabled={form.isTesting}>
            {t("testConnection")}
          </Button>
          {form.testResult ? (
            <ThemedText
              style={[
                styles.testStatus,
                {
                  color: form.testResult.success ? theme.success : theme.error,
                },
              ]}
            >
              {form.testResult.success
                ? t("connectionSuccess")
                : t("connectionFailed")}
            </ThemedText>
          ) : null}
        </View>
      )}
      {form.testResult?.steps?.length ? (
        <View style={styles.testDetails}>
          {form.testResult.steps.map((s) => (
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
    </>
  );
}

export default function ERPSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isUnlocked, isAuthenticating, authenticate } = useBiometricAuth();
  useProtectScreen();

  const { erp, setERPSettings } = useSettingsStore();

  const [form, updateForm] = useReducer(formReducer, {
    provider: erp.provider,
    erpUrl: erp.url,
    erpDb: erp.db || "",
    erpUsername: erp.username,
    erpPassword: erp.password,
    erpApiKey: erp.apiKey,
    specUrl: erp.specUrl,
    apiType: erp.apiType as APIType,
    isTesting: false,
    testResult: null,
  });

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
      provider: form.provider,
      url: form.erpUrl,
      db: form.erpDb,
      username: form.erpUsername,
      password: form.erpPassword,
      apiKey: form.erpApiKey,
      specUrl: form.specUrl,
      apiType: form.apiType,
    });
    navigation.goBack();
  };

  const handleTestConnection = async () => {
    updateForm({ isTesting: true, testResult: null });
    const credentials = {
      erpProvider: form.provider,
      erpBaseUrl: form.erpUrl,
      erpApiType: form.apiType,
      erpDb: form.erpDb || undefined,
      erpUsername: form.erpUsername || undefined,
      erpPassword: form.erpPassword || undefined,
      erpApiKey: form.erpApiKey || undefined,
    } as EphemeralCredentials;
    try {
      const res = await secureApiRequest(
        "POST",
        "erp/test",
        {
          erpSettings: {
            provider: form.provider,
            baseUrl: form.erpUrl,
            db: form.erpDb,
            username: form.erpUsername,
            apiType: form.apiType,
            openApiSpecUrl: form.specUrl,
          },
        },
        credentials,
      );
      const json = (await res.json()) as {
        success: boolean;
        steps?: { name: string; ok: boolean; error?: string }[];
      };
      updateForm({ testResult: json });
    } catch (e) {
      updateForm({
        testResult: {
          success: false,
          steps: [{ name: "request", ok: false, error: String(e) }],
        },
      });
    }
    updateForm({ isTesting: false });
  };

  const providerDocsUrlByProvider: Partial<Record<ERPProvider, string>> = {
    "1c": "https://kb.1ci.com/1C_Enterprise_Platform/FAQ/Development/Integration/Publishing_standard_REST_API_for_your_infobase/",
  };

  const selectedProviderDocsUrl = providerDocsUrlByProvider[form.provider];
  const selectedProviderLabel = form.provider === "1c" ? "1C" : form.provider;

  const handleOpenSelectedProviderDocs = async () => {
    if (!selectedProviderDocsUrl) return;
    await Linking.openURL(selectedProviderDocsUrl);
  };

  const isCustom = form.provider === "custom";
  const isSap = form.provider === "sap";
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

        <ERPProviderSelector
          form={form}
          updateForm={updateForm}
          theme={theme}
          t={t}
          providers={providers}
        />

        <ERPCredentialsForm
          form={form}
          updateForm={updateForm}
          theme={theme}
          t={t}
        />
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
                  form.apiType === type.id && {
                    borderColor: theme.primary,
                    backgroundColor: theme.primary + "10",
                  },
                ]}
                onPress={() => updateForm({ apiType: type.id })}
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
                {form.apiType === type.id ? (
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
        <TestConnectionResult
          form={form}
          updateForm={updateForm}
          theme={theme}
          t={t}
          onTestConnection={handleTestConnection}
        />
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
