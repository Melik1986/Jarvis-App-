import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Svg, { Path, Circle, Rect } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import {
  AnimatedCheckIcon,
  AnimatedChevronIcon,
} from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useProtectScreen } from "@/hooks/useProtectScreen";
import { Spacing, BorderRadius } from "@/constants/theme";

type LLMProvider = "replit" | "openai" | "ollama" | "groq" | "custom";
type ProviderIconName = "flash" | "chip" | "server" | "speedometer" | "code";

const modelsByProvider: Record<LLMProvider, string[]> = {
  replit: ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "claude-3-haiku"],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "o1-preview",
    "o1-mini",
  ],
  ollama: ["llama3.2", "llama3.1", "mistral", "codellama", "phi3", "gemma2"],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ],
  custom: ["gpt-4o", "claude-3.5-sonnet", "llama3.1-70b"],
};

const transcriptionModelsByProvider: Record<LLMProvider, string> = {
  replit: "gpt-4o-mini-transcribe",
  openai: "gpt-4o-mini-transcribe",
  groq: "whisper-large-v3",
  ollama: "",
  custom: "",
};

function ProviderIcon({
  name,
  size = 20,
  color,
}: {
  name: ProviderIconName;
  size?: number;
  color: string;
}) {
  const strokeWidth = 1.5;

  switch (name) {
    case "flash":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "chip":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="2"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="9"
            y="9"
            width="6"
            height="6"
            rx="1"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );
    case "server":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x="2"
            y="2"
            width="20"
            height="8"
            rx="2"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="2"
            y="14"
            width="20"
            height="8"
            rx="2"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Circle cx="6" cy="6" r="1" fill={color} />
          <Circle cx="6" cy="18" r="1" fill={color} />
        </Svg>
      );
    case "speedometer":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="12"
            r="10"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "code":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="m16 18 6-6-6-6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m8 6-6 6 6 6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return null;
  }
}

export default function LLMProviderScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isUnlocked, isAuthenticating, authenticate } = useBiometricAuth();
  useProtectScreen();

  const { llm, setLLMSettings } = useSettingsStore();

  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(
    llm.provider,
  );
  const [baseUrl, setBaseUrl] = useState(llm.baseUrl);
  const [apiKey, setApiKey] = useState(llm.apiKey);
  const [modelName, setModelName] = useState(llm.modelName);
  const [transcriptionModel, setTranscriptionModel] = useState(
    llm.transcriptionModel || "",
  );
  const [userInstructions, setUserInstructions] = useState(
    llm.userInstructions || "",
  );
  const [showModelPicker, setShowModelPicker] = useState(false);

  const providers: {
    id: LLMProvider;
    name: string;
    description: string;
    icon: ProviderIconName;
  }[] = [
    {
      id: "replit",
      name: t("replitAI"),
      description: t("builtInAI"),
      icon: "flash",
    },
    { id: "openai", name: "OpenAI", description: t("gptModels"), icon: "chip" },
    {
      id: "ollama",
      name: "Ollama",
      description: t("localModels"),
      icon: "server",
    },
    {
      id: "groq",
      name: "Groq",
      description: t("ultraFast"),
      icon: "speedometer",
    },
    {
      id: "custom",
      name: t("custom"),
      description: t("openAICompatible"),
      icon: "code",
    },
  ];

  const handleSave = () => {
    setLLMSettings({
      provider: selectedProvider,
      baseUrl,
      apiKey,
      modelName,
      transcriptionModel,
      userInstructions,
    });
    navigation.goBack();
  };

  const handleProviderSelect = (providerId: LLMProvider) => {
    setSelectedProvider(providerId);
    const defaultModel = modelsByProvider[providerId][0] ?? "";
    setModelName(defaultModel);
    setTranscriptionModel(transcriptionModelsByProvider[providerId]);
  };

  const providerDocsUrlByProvider: Partial<Record<LLMProvider, string>> = {
    replit: "https://docs.replit.com/replitai/replit-ai-integrations",
    openai: "https://platform.openai.com/api-keys",
    groq: "https://console.groq.com/keys",
    ollama: "https://docs.ollama.com/api/openai-compatibility",
    custom: "https://platform.openai.com/api-keys",
  };

  const selectedProviderDocsUrl = providerDocsUrlByProvider[selectedProvider];
  const selectedProviderLabel =
    providers.find((p) => p.id === selectedProvider)?.name ?? selectedProvider;

  const handleOpenSelectedProviderDocs = async () => {
    if (!selectedProviderDocsUrl) return;
    await Linking.openURL(selectedProviderDocsUrl);
  };

  const showCustomFields = selectedProvider !== "replit";
  const availableModels = modelsByProvider[selectedProvider];

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
        <ThemedText
          style={[styles.sectionDescription, { color: theme.textSecondary }]}
        >
          {t("chooseProvider")}
        </ThemedText>

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
            💡 {t("llmHint")}
          </ThemedText>
        </View>

        <View style={styles.providerList}>
          {providers.map((provider) => (
            <Pressable
              key={provider.id}
              style={[
                styles.providerItem,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
                selectedProvider === provider.id && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primary + "10",
                },
              ]}
              onPress={() => handleProviderSelect(provider.id)}
            >
              <View style={styles.providerIcon}>
                <ProviderIcon
                  name={provider.icon}
                  size={20}
                  color={theme.primary}
                />
              </View>
              <View style={styles.providerContent}>
                <ThemedText
                  style={[styles.providerName, { color: theme.text }]}
                >
                  {provider.name}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.providerDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {provider.description}
                </ThemedText>
              </View>
              {selectedProvider === provider.id ? (
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

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("model")}
        </ThemedText>
        <Pressable
          style={[
            styles.modelPicker,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setShowModelPicker(true)}
        >
          <ThemedText style={[styles.modelPickerText, { color: theme.text }]}>
            {modelName || availableModels[0]}
          </ThemedText>
          <AnimatedChevronIcon size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("transcriptionModel")}
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
          placeholder={
            transcriptionModelsByProvider[selectedProvider] || "whisper-1"
          }
          placeholderTextColor={theme.textTertiary}
          value={transcriptionModel}
          onChangeText={setTranscriptionModel}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("customInstructions")}
        </ThemedText>
        <ThemedText
          style={[styles.sectionDescription, { color: theme.textSecondary }]}
        >
          {t("customInstructionsDesc")}
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              color: theme.text,
              minHeight: 120,
              textAlignVertical: "top",
            },
          ]}
          placeholder={t("customInstructionsPlaceholder")}
          placeholderTextColor={theme.textTertiary}
          value={userInstructions}
          onChangeText={setUserInstructions}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {showCustomFields ? (
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            {t("providerSettings")}
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {t("baseUrl")}
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
              placeholder={
                selectedProvider === "ollama"
                  ? "http://localhost:11434/v1"
                  : "https://api.openai.com/v1"
              }
              placeholderTextColor={theme.textTertiary}
              value={baseUrl}
              onChangeText={setBaseUrl}
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
              placeholder="sk-..."
              placeholderTextColor={theme.textTertiary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>{t("saveSettings")}</Button>
      </View>

      <Modal
        visible={showModelPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {t("model")}
              </ThemedText>
              <Pressable onPress={() => setShowModelPicker(false)}>
                <ThemedText style={{ color: theme.primary }}>
                  {t("save")}
                </ThemedText>
              </Pressable>
            </View>
            <FlatList
              data={availableModels}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.modelOption,
                    { borderBottomColor: theme.border },
                    modelName === item && {
                      backgroundColor: theme.primary + "15",
                    },
                  ]}
                  onPress={() => {
                    setModelName(item);
                    setShowModelPicker(false);
                  }}
                >
                  <ThemedText style={{ color: theme.text }}>{item}</ThemedText>
                  {modelName === item ? (
                    <AnimatedCheckIcon size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
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
  providerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
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
  modelPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  modelPickerText: {
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  modelOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
});
