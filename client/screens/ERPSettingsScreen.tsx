import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

type APIType = "odata" | "rest" | "graphql";

export default function ERPSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { erp, setERPSettings } = useSettingsStore();

  const [erpUrl, setErpUrl] = useState(erp.url);
  const [erpApiKey, setErpApiKey] = useState(erp.apiKey);
  const [specUrl, setSpecUrl] = useState(erp.specUrl);
  const [apiType, setApiType] = useState<APIType>(erp.apiType as APIType);

  const apiTypes: { id: APIType; name: string; descriptionKey: string }[] = [
    { id: "odata", name: t("odata"), descriptionKey: "odataDesc" },
    { id: "rest", name: t("rest"), descriptionKey: "restDesc" },
    { id: "graphql", name: t("graphql"), descriptionKey: "graphqlDesc" },
  ];

  const handleSave = () => {
    setERPSettings({
      url: erpUrl,
      apiKey: erpApiKey,
      specUrl,
      apiType,
    });
    navigation.goBack();
  };

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
          {t("connectERP")}
        </ThemedText>

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
            placeholder="https://your-erp.com/api"
            placeholderTextColor={theme.textTertiary}
            value={erpUrl}
            onChangeText={setErpUrl}
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
            placeholder={t("erpApiKeyPlaceholder")}
            placeholderTextColor={theme.textTertiary}
            value={erpApiKey}
            onChangeText={setErpApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

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
      </View>

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
                  {t(type.descriptionKey as any)}
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
