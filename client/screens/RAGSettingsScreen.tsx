import React, { useState } from "react";
import {
  StyleSheet,
  View,
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
import {
  useSettingsStore,
  RagProvider,
  RagSettings,
} from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useProtectScreen } from "@/hooks/useProtectScreen";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function RAGSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isUnlocked, isAuthenticating, authenticate } = useBiometricAuth();
  useProtectScreen();

  const { rag, setRagSettings } = useSettingsStore();

  // Zero-storage: provider selection lives entirely in the client store.
  // No server round-trip needed — getCurrentProvider() is always "none".
  const [provider, setProvider] = useState<RagProvider>(rag.provider);
  const [qdrantUrl, setQdrantUrl] = useState(rag.qdrant.url);
  const [qdrantApiKey, setQdrantApiKey] = useState(rag.qdrant.apiKey);
  const [collectionName, setCollectionName] = useState(
    rag.qdrant.collectionName,
  );
  const [supabaseUrl, setSupabaseUrl] = useState(rag.supabase.url);
  const [supabaseApiKey, setSupabaseApiKey] = useState(rag.supabase.apiKey);
  const [supabaseTable, setSupabaseTable] = useState(rag.supabase.tableName);
  const [replitTable, setReplitTable] = useState(rag.replit.tableName);

  const providers: { id: RagProvider; name: string; description: string }[] = [
    {
      id: "replit",
      name: "Replit PostgreSQL",
      description: "Built-in vector storage with pgvector",
    },
    {
      id: "qdrant",
      name: "Qdrant",
      description: t("qdrantDesc") || "Dedicated vector database service",
    },
    {
      id: "supabase",
      name: "Supabase",
      description: "PostgreSQL with vector extensions",
    },
    {
      id: "none",
      name: t("disabled") || "Disabled",
      description: t("ragDisabledDesc") || "No knowledge base integration",
    },
  ];

  const loading = false; // Data comes from local store, no server fetch needed
  const [saving, setSaving] = useState(false);

  const providerDocsUrlByProvider: Partial<Record<RagProvider, string>> = {
    supabase: "https://supabase.com/docs/guides/api/api-keys",
    qdrant: "https://qdrant.tech/documentation/cloud/authentication/",
    replit:
      "https://docs.replit.com/cloud-services/storage-and-databases/sql-database",
  };

  const selectedProviderDocsUrl =
    provider === null ? undefined : providerDocsUrlByProvider[provider];
  const selectedProviderLabel =
    providers.find((p) => p.id === provider)?.name ?? provider ?? "";

  const handleOpenSelectedProviderDocs = async () => {
    if (!selectedProviderDocsUrl) return;
    await Linking.openURL(selectedProviderDocsUrl);
  };

  const handleSave = () => {
    if (!provider) return;

    setSaving(true);
    const settings: RagSettings = {
      provider,
      qdrant: {
        url: qdrantUrl,
        apiKey: qdrantApiKey,
        collectionName: collectionName || "kb_axon",
      },
      supabase: {
        url: supabaseUrl,
        apiKey: supabaseApiKey,
        tableName: supabaseTable || "documents",
      },
      replit: {
        tableName: replitTable || "rag_documents",
      },
    };

    // Zero-storage: save only to local Zustand store (persisted via SecureStore).
    // Server setProvider() is a noop — no server round-trip needed.
    setRagSettings(settings);
    setSaving(false);
    navigation.goBack();
  };

  if (loading || !isUnlocked) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        {!isUnlocked && !isAuthenticating ? (
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <ThemedText
              style={{ marginBottom: Spacing.lg, textAlign: "center" }}
            >
              {t("accessBlocked")}
            </ThemedText>
            <Button onPress={authenticate}>{t("tryAgain")}</Button>
          </View>
        ) : (
          <ActivityIndicator size="large" color={theme.primary} />
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
            💡 {t("ragHint")}
          </ThemedText>
        </View>

        <View style={styles.providerList}>
          {providers.map((p) => (
            <Pressable
              key={p.id}
              style={[
                styles.providerItem,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
                provider === p.id && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primary + "10",
                },
              ]}
              onPress={() => setProvider(p.id)}
            >
              <View style={styles.providerContent}>
                <ThemedText
                  style={[styles.providerName, { color: theme.text }]}
                >
                  {p.name}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.providerDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {p.description}
                </ThemedText>
              </View>
              {provider === p.id ? (
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
      </View>

      {provider === "qdrant" && (
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            QDRANT SETTINGS
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("qdrantUrl") || "Qdrant URL"}
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
              placeholder="https://your-qdrant-instance.cloud.qdrant.io"
              placeholderTextColor={theme.textTertiary}
              value={qdrantUrl}
              onChangeText={setQdrantUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

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
              placeholder={t("optional") || "Optional"}
              placeholderTextColor={theme.textTertiary}
              value={qdrantApiKey}
              onChangeText={setQdrantApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("collectionName") || "Collection Name"}
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
              placeholder="kb_axon"
              placeholderTextColor={theme.textTertiary}
              value={collectionName}
              onChangeText={setCollectionName}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      {provider === "supabase" && (
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            SUPABASE SETTINGS
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              Supabase URL
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
              placeholder="https://your-project.supabase.co"
              placeholderTextColor={theme.textTertiary}
              value={supabaseUrl}
              onChangeText={setSupabaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

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
              placeholder="your-anon-key"
              placeholderTextColor={theme.textTertiary}
              value={supabaseApiKey}
              onChangeText={setSupabaseApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              Table Name
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
              placeholder="documents"
              placeholderTextColor={theme.textTertiary}
              value={supabaseTable}
              onChangeText={setSupabaseTable}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      {provider === "replit" && (
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            REPLIT POSTGRESQL SETTINGS
          </ThemedText>

          <ThemedText
            style={[styles.sectionDescription, { color: theme.textSecondary }]}
          >
            Uses the built-in PostgreSQL database with pgvector extension for
            vector storage.
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              Table Name
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
              placeholder="rag_documents"
              placeholderTextColor={theme.textTertiary}
              value={replitTable}
              onChangeText={setReplitTable}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave} disabled={saving}>
          {saving ? "Saving..." : t("saveSettings")}
        </Button>
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
  providerList: {
    gap: Spacing.sm,
  },
  providerItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  providerContent: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  providerDescription: {
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
    marginTop: Spacing.md,
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
  textInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
  },
});
