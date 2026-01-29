import React from "react";
import { StyleSheet, View, Image, ScrollView, Pressable, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { SettingsItem } from "@/components/SettingsItem";
import { AnimatedPencilIcon, AnimatedLogoutIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

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

  const { llm, erp, voice, language } = useSettingsStore();

  const getLLMProviderLabel = () => {
    switch (llm.provider) {
      case "replit":
        return "Replit AI";
      case "openai":
        return "OpenAI";
      case "ollama":
        return "Ollama (Local)";
      case "groq":
        return "Groq";
      default:
        return "Custom";
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

  const handleOpenHelp = async () => {
    handleHaptic();
    try {
      await Linking.openURL("https://jsrvis.com/help");
    } catch (e) {
      console.log("Could not open help URL");
    }
  };

  const handleOpenPrivacy = async () => {
    handleHaptic();
    try {
      await Linking.openURL("https://jsrvis.com/privacy");
    } catch (e) {
      console.log("Could not open privacy URL");
    }
  };

  const handleLogout = () => {
    handleHaptic();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image
            source={require("../../assets/images/avatar-default.png")}
            style={styles.avatar}
          />
          <Pressable style={styles.editAvatarButton} onPress={handleHaptic}>
            <AnimatedPencilIcon size={14} color={Colors.dark.buttonText} />
          </Pressable>
        </View>
        <ThemedText type="h3" style={styles.userName}>
          User
        </ThemedText>
        <ThemedText style={styles.userSubtitle}>
          JSRVIS Enterprise
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>AI Settings</ThemedText>
        <SettingsItem
          icon="hardware-chip-outline"
          title="LLM Provider"
          value={getLLMProviderLabel()}
          onPress={() => handleNavigate("LLMProvider")}
        />
        <SettingsItem
          icon="terminal-outline"
          title="Model"
          value={llm.modelName || "gpt-5.1"}
          onPress={() => handleNavigate("LLMProvider")}
        />
        <SettingsItem
          icon="volume-medium-outline"
          title="Voice"
          value={voice.charAt(0).toUpperCase() + voice.slice(1)}
          onPress={() => handleNavigate("Voice")}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>ERP Connection</ThemedText>
        <SettingsItem
          icon="link-outline"
          title="System URL"
          subtitle={erp.url || "Not configured"}
          onPress={() => handleNavigate("ERPSettings")}
        />
        <SettingsItem
          icon="code-slash-outline"
          title="API Type"
          value={erp.apiType.toUpperCase()}
          onPress={() => handleNavigate("ERPSettings")}
        />
        <SettingsItem
          icon="document-text-outline"
          title="API Specification"
          subtitle={erp.specUrl || "Not configured"}
          onPress={() => handleNavigate("ERPSettings")}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
        <SettingsItem
          icon="globe-outline"
          title="Language"
          value={languageNames[language] || language}
          onPress={() => handleNavigate("Language")}
        />
        <SettingsItem
          icon="moon-outline"
          title="Theme"
          value="Dark"
          showChevron={false}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>About</ThemedText>
        <SettingsItem
          icon="information-circle-outline"
          title="Version"
          value="1.0.0"
          showChevron={false}
        />
        <SettingsItem
          icon="help-circle-outline"
          title="Help & Support"
          onPress={handleOpenHelp}
        />
        <SettingsItem
          icon="shield-outline"
          title="Privacy Policy"
          onPress={handleOpenPrivacy}
        />
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <AnimatedLogoutIcon size={20} color={Colors.dark.error} />
        <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
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
    borderColor: Colors.dark.primary,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.dark.backgroundRoot,
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  userSubtitle: {
    color: Colors.dark.textSecondary,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.dark.error + "15",
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  logoutText: {
    color: Colors.dark.error,
    fontSize: 16,
    fontWeight: "600",
  },
});
