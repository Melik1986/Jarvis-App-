import React from "react";
import { StyleSheet, View, ActivityIndicator, Modal } from "react-native";
import { useLoadingStore } from "@/store/loadingStore";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

export function GlobalLoader() {
  const { isLoading, message } = useLoadingStore();
  const { theme } = useTheme();

  if (!isLoading) return null;

  return (
    <Modal transparent visible={isLoading} animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ActivityIndicator size="large" color={theme.primary} />
          {message ? (
            <ThemedText style={styles.message}>{message}</ThemedText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    minWidth: 120,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  message: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
});
