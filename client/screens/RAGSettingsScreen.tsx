import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore, RagProvider } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function RAGSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { rag, setRagSettings } = useSettingsStore();

  const [provider, setProvider] = useState<RagProvider>(rag.provider);
  const [qdrantUrl, setQdrantUrl] = useState(rag.qdrant.url);
  const [qdrantApiKey, setQdrantApiKey] = useState(rag.qdrant.apiKey);
  const [collectionName, setCollectionName] = useState(
    rag.qdrant.collectionName,
  );

  const providers: { id: RagProvider; name: string; description: string }[] = [
    {
      id: "qdrant",
      name: "Qdrant",
      description: t("qdrantDesc") || "Vector database for semantic search",
    },
    {
      id: "none",
      name: t("disabled") || "Disabled",
      description: t("ragDisabledDesc") || "No knowledge base integration",
    },
  ];

  const handleSave = () => {
    setRagSettings({
      provider,
      qdrant: {
        url: qdrantUrl,
        apiKey: qdrantApiKey,
        collectionName: collectionName || "kb_jarvis",
      },
    });
    navigation.goBack();
  };

  const isQdrantEnabled = provider === "qdrant";

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
        <ThemedText
          style={[styles.sectionDescription, { color: theme.textSecondary }]}
        >
          {t("ragSettingsDesc") ||
            "Configure your knowledge base for context-aware AI responses"}
        </ThemedText>

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
      </View>

      {isQdrantEnabled && (
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            {t("qdrantSettings") || "QDRANT SETTINGS"}
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
              placeholder="kb_jarvis"
              placeholderTextColor={theme.textTertiary}
              value={collectionName}
              onChangeText={setCollectionName}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>{t("saveSettings")}</Button>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
