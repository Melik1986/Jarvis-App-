import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

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

  const { language, setLanguage } = useSettingsStore();
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  const handleSave = () => {
    setLanguage(selectedLanguage);
    navigation.goBack();
  };

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
          Select your preferred language for the app interface.
        </ThemedText>

        <View style={styles.languageList}>
          {languages.map((lang) => (
            <Pressable
              key={lang.id}
              style={[
                styles.languageItem,
                selectedLanguage === lang.id && styles.languageItemSelected,
              ]}
              onPress={() => setSelectedLanguage(lang.id)}
            >
              <View style={styles.languageContent}>
                <ThemedText style={styles.languageName}>{lang.name}</ThemedText>
                <ThemedText style={styles.languageNative}>{lang.nativeName}</ThemedText>
              </View>
              {selectedLanguage === lang.id ? (
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={16} color={Colors.dark.buttonText} />
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>Save Language</Button>
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
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  languageList: {
    gap: Spacing.sm,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  languageItemSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + "10",
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
  buttonContainer: {
    marginTop: Spacing.lg,
  },
});
