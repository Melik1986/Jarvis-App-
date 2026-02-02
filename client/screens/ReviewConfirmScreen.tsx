import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { DiffView } from "../components/DiffView";

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
  resultSummary: string;
  diffPreview?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  confidence: number; // 0-1
}

interface ReviewConfirmScreenProps {
  toolCalls: ToolCall[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReviewConfirmScreen({
  toolCalls,
  onConfirm,
  onCancel,
}: ReviewConfirmScreenProps) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>AI понял вашу команду так:</Text>

      {toolCalls.map((call, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.toolName}>{call.toolName}</Text>

          {call.diffPreview && (
            <DiffView
              before={call.diffPreview.before}
              after={call.diffPreview.after}
            />
          )}

          <Text style={styles.resultSummary}>{call.resultSummary}</Text>

          <View
            style={[
              styles.confidenceBadge,
              call.confidence < 0.9 && styles.confidenceWarning,
            ]}
          >
            <Text style={styles.confidenceText}>
              Confidence: {Math.round(call.confidence * 100)}%
            </Text>
            {call.confidence < 0.9 && (
              <Text style={styles.warning}>
                ⚠️ Low confidence. Double-check before confirming.
              </Text>
            )}
          </View>
        </View>
      ))}

      <View style={styles.actions}>
        <View style={styles.button} onTouchEnd={onConfirm}>
          <Text style={styles.buttonText}>Подтвердить и отправить в ERP</Text>
        </View>
        <View
          style={[styles.button, styles.buttonCancel]}
          onTouchEnd={onCancel}
        >
          <Text style={[styles.buttonText, styles.buttonCancelText]}>
            Отмена
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toolName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1976d2",
  },
  resultSummary: {
    fontSize: 14,
    color: "#333",
    marginTop: 8,
  },
  confidenceBadge: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#e8f5e9",
    borderRadius: 4,
  },
  confidenceWarning: {
    backgroundColor: "#fff3cd",
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2e7d32",
  },
  warning: {
    fontSize: 12,
    color: "#f57c00",
    marginTop: 4,
  },
  actions: {
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#1976d2",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#1976d2",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonCancelText: {
    color: "#1976d2",
  },
});
