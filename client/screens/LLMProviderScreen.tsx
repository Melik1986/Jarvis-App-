import React, { useState } from "react";
import { StyleSheet, View, TextInput, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

type LLMProvider = "replit" | "openai" | "ollama" | "groq" | "custom";
type ProviderIconName = "flash" | "chip" | "server" | "speedometer" | "code";

function ProviderIcon({ name, size = 20, color }: { name: ProviderIconName; size?: number; color: string }) {
  const strokeWidth = 1.5;
  
  switch (name) {
    case "flash":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "chip":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="5" y="5" width="14" height="14" rx="2" stroke={color} strokeWidth={strokeWidth} />
          <Rect x="9" y="9" width="6" height="6" rx="1" stroke={color} strokeWidth={strokeWidth} />
          <Path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </Svg>
      );
    case "server":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="2" y="2" width="20" height="8" rx="2" stroke={color} strokeWidth={strokeWidth} />
          <Rect x="2" y="14" width="20" height="8" rx="2" stroke={color} strokeWidth={strokeWidth} />
          <Circle cx="6" cy="6" r="1" fill={color} />
          <Circle cx="6" cy="18" r="1" fill={color} />
        </Svg>
      );
    case "speedometer":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
          <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "code":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="m16 18 6-6-6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="m8 6-6 6 6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

const providers: { id: LLMProvider; name: string; description: string; icon: ProviderIconName }[] = [
  { id: "replit", name: "Replit AI", description: "Built-in AI (recommended)", icon: "flash" },
  { id: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5", icon: "chip" },
  { id: "ollama", name: "Ollama", description: "Local models (free)", icon: "server" },
  { id: "groq", name: "Groq", description: "Ultra-fast inference", icon: "speedometer" },
  { id: "custom", name: "Custom", description: "OpenAI-compatible API", icon: "code" },
];

export default function LLMProviderScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();

  const { llm, setLLMSettings } = useSettingsStore();

  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(llm.provider);
  const [baseUrl, setBaseUrl] = useState(llm.baseUrl);
  const [apiKey, setApiKey] = useState(llm.apiKey);
  const [modelName, setModelName] = useState(llm.modelName);

  const handleSave = () => {
    setLLMSettings({
      provider: selectedProvider,
      baseUrl,
      apiKey,
      modelName,
    });
    navigation.goBack();
  };

  const showCustomFields = selectedProvider !== "replit";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.section}>
        <ThemedText style={styles.sectionDescription}>
          Choose your AI model provider. Replit AI is included free with your account.
        </ThemedText>

        <View style={styles.providerList}>
          {providers.map((provider) => (
            <Pressable
              key={provider.id}
              style={[
                styles.providerItem,
                selectedProvider === provider.id && styles.providerItemSelected,
              ]}
              onPress={() => setSelectedProvider(provider.id)}
            >
              <View style={styles.providerIcon}>
                <ProviderIcon name={provider.icon} size={20} color={Colors.dark.primary} />
              </View>
              <View style={styles.providerContent}>
                <ThemedText style={styles.providerName}>{provider.name}</ThemedText>
                <ThemedText style={styles.providerDescription}>
                  {provider.description}
                </ThemedText>
              </View>
              {selectedProvider === provider.id ? (
                <View style={styles.checkCircle}>
                  <AnimatedCheckIcon size={16} color={Colors.dark.buttonText} />
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {showCustomFields ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Provider Settings</ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Base URL</ThemedText>
            <TextInput
              style={styles.textInput}
              placeholder={
                selectedProvider === "ollama"
                  ? "http://localhost:11434/v1"
                  : "https://api.openai.com/v1"
              }
              placeholderTextColor={Colors.dark.textTertiary}
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>API Key</ThemedText>
            <TextInput
              style={styles.textInput}
              placeholder="sk-..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Model Name</ThemedText>
            <TextInput
              style={styles.textInput}
              placeholder="gpt-4o, llama3-70b, etc."
              placeholderTextColor={Colors.dark.textTertiary}
              value={modelName}
              onChangeText={setModelName}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>Save Settings</Button>
      </View>
    </ScrollView>
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
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  providerList: {
    gap: Spacing.sm,
  },
  providerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  providerItemSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + "10",
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
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
    color: Colors.dark.textSecondary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
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
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.dark.text,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
  },
});
