import React from "react";
import {
  StyleSheet,
  View,
  Image,
  ScrollView,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { SettingsItem } from "@/components/SettingsItem";
import {
  AnimatedPencilIcon,
  AnimatedLogoutIcon,
  AnimatedSunIcon,
  AnimatedMoonIcon,
} from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

const languageNames: Record<string, string> = {
  ru: "Русский",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  zh: "中文",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme, toggleTheme, isDark } = useTheme();
  const { t } = useTranslation();

  const { llm, erp, voice, language } = useSettingsStore();

  const getLLMProviderLabel = () => {
    switch (llm.provider) {
      case "replit":
        return t("replitAI");
      case "openai":
        return "OpenAI";
      case "ollama":
        return "Ollama";
      case "groq":
        return "Groq";
      default:
        return t("custom");
    }
  };

  const handleHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleNavigate = (screen: string) => {
    handleHaptic();
    navigation.navigate(screen);
  };

  const handleToggleTheme = () => {
    handleHaptic();
    toggleTheme();
  };

  const handleOpenHelp = async () => {
    handleHaptic();
    try {
      await Linking.openURL("https://jsrvis.com/help");
    } catch {
      console.log("Could not open help URL");
    }
  };

  const handleOpenPrivacy = async () => {
    handleHaptic();
    try {
      await Linking.openURL("https://jsrvis.com/privacy");
    } catch {
      console.log("Could not open privacy URL");
    }
  };

  const handleLogout = () => {
    handleHaptic();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image
            source={require("../../assets/images/avatar-default.png")}
            style={[styles.avatar, { borderColor: theme.primary }]}
          />
          <Pressable
            style={[
              styles.editAvatarButton,
              {
                backgroundColor: theme.primary,
                borderColor: theme.backgroundRoot,
              },
            ]}
            onPress={handleHaptic}
          >
            <AnimatedPencilIcon size={14} color={theme.buttonText} />
          </Pressable>
        </View>
        <ThemedText type="h3" style={[styles.userName, { color: theme.text }]}>
          {t("user")}
        </ThemedText>
        <ThemedText
          style={[styles.userSubtitle, { color: theme.textSecondary }]}
        >
          {t("enterprise")}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("aiSettings")}
        </ThemedText>
        <SettingsItem
          icon="hardware-chip-outline"
          title={t("llmProvider")}
          value={getLLMProviderLabel()}
          onPress={() => handleNavigate("LLMProvider")}
        />
        <SettingsItem
          icon="terminal-outline"
          title={t("model")}
          value={llm.modelName || "gpt-4o"}
          onPress={() => handleNavigate("LLMProvider")}
        />
        <SettingsItem
          icon="volume-medium-outline"
          title={t("voice")}
          value={voice.charAt(0).toUpperCase() + voice.slice(1)}
          onPress={() => handleNavigate("Voice")}
        />
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("erpConnection")}
        </ThemedText>
        <SettingsItem
          icon="link-outline"
          title={t("systemUrl")}
          subtitle={erp.url || t("notConfigured")}
          onPress={() => handleNavigate("ERPSettings")}
        />
        <SettingsItem
          icon="code-slash-outline"
          title={t("apiType")}
          value={erp.apiType.toUpperCase()}
          onPress={() => handleNavigate("ERPSettings")}
        />
        <SettingsItem
          icon="document-text-outline"
          title={t("apiSpecification")}
          subtitle={erp.specUrl || t("notConfigured")}
          onPress={() => handleNavigate("ERPSettings")}
        />
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("preferences")}
        </ThemedText>
        <SettingsItem
          icon="globe-outline"
          title={t("language")}
          value={languageNames[language] || language}
          onPress={() => handleNavigate("Language")}
        />
        <Pressable
          style={[
            styles.themeRow,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          onPress={handleToggleTheme}
        >
          <View style={styles.themeRowLeft}>
            {isDark ? (
              <AnimatedMoonIcon size={22} color={theme.primary} />
            ) : (
              <AnimatedSunIcon size={22} color={theme.primary} />
            )}
            <ThemedText style={[styles.themeRowTitle, { color: theme.text }]}>
              {t("theme")}
            </ThemedText>
          </View>
          <View
            style={[
              styles.themeToggle,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Pressable
              style={[
                styles.themeOption,
                !isDark && { backgroundColor: theme.primary },
              ]}
              onPress={() => !isDark || handleToggleTheme()}
            >
              <AnimatedSunIcon
                size={16}
                color={!isDark ? theme.buttonText : theme.textTertiary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.themeOption,
                isDark && { backgroundColor: theme.primary },
              ]}
              onPress={() => isDark || handleToggleTheme()}
            >
              <AnimatedMoonIcon
                size={16}
                color={isDark ? theme.buttonText : theme.textTertiary}
              />
            </Pressable>
          </View>
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textTertiary }]}
        >
          {t("about")}
        </ThemedText>
        <SettingsItem
          icon="information-circle-outline"
          title={t("version")}
          value="1.0.0"
          showChevron={false}
        />
        <SettingsItem
          icon="help-circle-outline"
          title={t("helpSupport")}
          onPress={handleOpenHelp}
        />
        <SettingsItem
          icon="shield-outline"
          title={t("privacyPolicy")}
          onPress={handleOpenPrivacy}
        />
      </View>

      <Pressable
        style={[styles.logoutButton, { backgroundColor: theme.error + "15" }]}
        onPress={handleLogout}
      >
        <AnimatedLogoutIcon size={20} color={theme.error} />
        <ThemedText style={[styles.logoutText, { color: theme.error }]}>
          {t("signOut")}
        </ThemedText>
      </Pressable>
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
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  userSubtitle: {},
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  themeRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  themeRowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  themeToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.full,
    padding: 4,
  },
  themeOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
