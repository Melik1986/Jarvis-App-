import React from "react";
import { View, StyleSheet } from "react-native";
import { useSpendingStore } from "@/store/spendingStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

export function SpendingTracker() {
  const { todayUsage, todayCost, requestLimit, requestsUsed } =
    useSpendingStore();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const progress = Math.min((requestsUsed / requestLimit) * 100, 100);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        },
      ]}
    >
      <ThemedText type="h4" style={styles.title}>
        {t("todayUsage")}
      </ThemedText>
      <ThemedText style={styles.text}>
        Tokens: {todayUsage.tokens.toLocaleString()} (~${todayCost.toFixed(2)})
      </ThemedText>
      <ThemedText style={styles.text}>
        Requests: {requestsUsed}/{requestLimit}
      </ThemedText>
      <View
        style={[
          styles.progressBarContainer,
          { backgroundColor: theme.backgroundTertiary },
        ]}
      >
        <View
          style={[
            styles.progressBar,
            {
              width: `${progress}%`,
              backgroundColor: theme.primary,
            },
            progress >= 90 && { backgroundColor: theme.error },
          ]}
        />
      </View>
      {progress >= 90 && (
        <ThemedText style={[styles.warning, { color: theme.error }]}>
          ⚠️ {t("approachingLimit")}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginVertical: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  text: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  warning: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
});
