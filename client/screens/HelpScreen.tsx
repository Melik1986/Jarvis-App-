import React from "react";
import { StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing } from "@/constants/theme";

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h2" style={styles.title}>
        {t("helpSupport")}
      </ThemedText>
      <ThemedText style={styles.text}>
        Axon - это ваш интеллектуальный помощник для работы с бизнес-данными.
      </ThemedText>
      <ThemedText type="h4" style={styles.sectionTitle}>
        Как пользоваться чатом?
      </ThemedText>
      <ThemedText style={styles.text}>
        Просто введите ваш запрос или используйте голосовой ввод. Axon может
        проверять остатки товаров, создавать счета и отвечать на вопросы по
        регламентам.
      </ThemedText>
      <ThemedText type="h4" style={styles.sectionTitle}>
        Поддержка
      </ThemedText>
      <ThemedText style={styles.text}>
        Если у вас возникли вопросы, свяжитесь с нами по почте: support@axon.ai
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
});
