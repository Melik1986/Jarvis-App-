import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

const languages = [
  { id: "ru", name: "Русский", nativeName: "Russian" },
  { id: "en", name: "English", nativeName: "English" },
  { id: "de", name: "Deutsch", nativeName: "German" },
  { id: "fr", name: "Français", nativeName: "French" },
  { id: "es", name: "Español", nativeName: "Spanish" },
  { id: "zh", name: "中文", nativeName: "Chinese" },
];

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { language, setLanguage } = useSettingsStore();
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  const handleSave = () => {
    setLanguage(selectedLanguage);
    navigation.goBack();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionDescription, { color: theme.textSecondary }]}
        >
          {t("selectLanguage")}
        </ThemedText>

        <View style={styles.languageList}>
          {languages.map((lang) => (
            <Pressable
              key={lang.id}
              style={[
                styles.languageItem,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
                selectedLanguage === lang.id && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primary + "10",
                },
              ]}
              onPress={() => setSelectedLanguage(lang.id)}
            >
              <View style={styles.languageContent}>
                <ThemedText
                  style={[styles.languageName, { color: theme.text }]}
                >
                  {lang.name}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.languageNative,
                    { color: theme.textSecondary },
                  ]}
                >
                  {lang.nativeName}
                </ThemedText>
              </View>
              {selectedLanguage === lang.id ? (
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
        <Button onPress={handleSave}>{t("saveLanguage")}</Button>
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
  sectionDescription: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  languageList: {
    gap: Spacing.sm,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  languageContent: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  languageNative: {
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
