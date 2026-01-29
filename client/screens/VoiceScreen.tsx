import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedVolumeIcon, AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

type VoiceType = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const voices: { id: VoiceType; name: string; description: string }[] = [
  { id: "alloy", name: "Alloy", description: "Neutral and balanced" },
  { id: "echo", name: "Echo", description: "Deep and resonant" },
  { id: "fable", name: "Fable", description: "Warm and expressive" },
  { id: "onyx", name: "Onyx", description: "Authoritative and clear" },
  { id: "nova", name: "Nova", description: "Soft and friendly" },
  { id: "shimmer", name: "Shimmer", description: "Light and energetic" },
];

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();

  const { voice, setVoice } = useSettingsStore();
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(voice as VoiceType);

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
      style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.section}>
        <ThemedText style={styles.sectionDescription}>
          Choose the voice for AI responses.
        </ThemedText>

        <View style={styles.voiceList}>
          {voices.map((v) => (
            <Pressable
              key={v.id}
              style={[
                styles.voiceItem,
                selectedVoice === v.id && styles.voiceItemSelected,
              ]}
              onPress={() => handleSelectVoice(v.id)}
            >
              <View style={styles.voiceIcon}>
                <AnimatedVolumeIcon size={20} color={Colors.dark.primary} />
              </View>
              <View style={styles.voiceContent}>
                <ThemedText style={styles.voiceName}>{v.name}</ThemedText>
                <ThemedText style={styles.voiceDescription}>{v.description}</ThemedText>
              </View>
              {selectedVoice === v.id ? (
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

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>Save Voice</Button>
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
  voiceList: {
    gap: Spacing.sm,
  },
  voiceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  voiceItemSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + "10",
  },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
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
