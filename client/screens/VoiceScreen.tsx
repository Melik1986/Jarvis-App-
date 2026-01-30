import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import {
  AnimatedVolumeIcon,
  AnimatedCheckIcon,
} from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

type VoiceType = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { voice, setVoice } = useSettingsStore();
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(
    voice as VoiceType,
  );

  const voices: { id: VoiceType; name: string; descriptionKey: string }[] = [
    { id: "alloy", name: "Alloy", descriptionKey: "neutralBalanced" },
    { id: "echo", name: "Echo", descriptionKey: "deepResonant" },
    { id: "fable", name: "Fable", descriptionKey: "warmExpressive" },
    { id: "onyx", name: "Onyx", descriptionKey: "authoritativeClear" },
    { id: "nova", name: "Nova", descriptionKey: "softFriendly" },
    { id: "shimmer", name: "Shimmer", descriptionKey: "lightEnergetic" },
  ];

  const handleSelectVoice = (voiceId: VoiceType) => {
    setSelectedVoice(voiceId);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = () => {
    setVoice(selectedVoice);
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
          {t("chooseVoice")}
        </ThemedText>

        <View style={styles.voiceList}>
          {voices.map((v) => (
            <Pressable
              key={v.id}
              style={[
                styles.voiceItem,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
                selectedVoice === v.id && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primary + "10",
                },
              ]}
              onPress={() => handleSelectVoice(v.id)}
            >
              <View
                style={[
                  styles.voiceIcon,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <AnimatedVolumeIcon size={20} color={theme.primary} />
              </View>
              <View style={styles.voiceContent}>
                <ThemedText style={[styles.voiceName, { color: theme.text }]}>
                  {v.name}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.voiceDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t(v.descriptionKey as any)}
                </ThemedText>
              </View>
              {selectedVoice === v.id ? (
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
        <Button onPress={handleSave}>{t("saveVoice")}</Button>
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
  voiceList: {
    gap: Spacing.sm,
  },
  voiceItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  voiceContent: {
    flex: 1,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  voiceDescription: {
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
