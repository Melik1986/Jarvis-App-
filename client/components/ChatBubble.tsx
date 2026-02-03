import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ChatMessage } from "@shared/types";

interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
  toolCalls?: ChatMessage["toolCalls"];
  onConfirm?: (toolName: string) => void;
  onReject?: (toolName: string) => void;
}

export function ChatBubble({
  content,
  isUser,
  isStreaming,
  toolCalls,
  onConfirm,
  onReject,
}: ChatBubbleProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: theme.primary }]
            : [
                styles.assistantBubble,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ],
        ]}
      >
        {content ? (
          <ThemedText
            style={[styles.text, isUser && { color: theme.buttonText }]}
          >
            {content}
            {isStreaming ? "▌" : ""}
          </ThemedText>
        ) : null}

        {toolCalls && toolCalls.length > 0 && (
          <View style={styles.toolCalls}>
            {toolCalls.map((tool, index) => (
              <View
                key={index}
                style={[
                  styles.toolCall,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <View style={styles.toolHeader}>
                  <Ionicons
                    name="construct-outline"
                    size={14}
                    color={theme.primary}
                  />
                  <ThemedText style={styles.toolName}>
                    {tool.toolName}
                  </ThemedText>

                  {tool.confidence !== undefined && (
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor:
                            tool.confidence > 0.85 ? "#dcfce7" : "#fee2e2",
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          fontSize: 10,
                          fontWeight: "bold",
                          color: tool.confidence > 0.85 ? "#166534" : "#991b1b",
                        }}
                      >
                        {Math.round(tool.confidence * 100)}%
                      </ThemedText>
                    </View>
                  )}
                </View>

                {tool.resultSummary ? (
                  <ThemedText style={styles.toolResult} numberOfLines={2}>
                    {tool.resultSummary}
                  </ThemedText>
                ) : (
                  <ThemedText
                    style={[styles.toolResult, { fontStyle: "italic" }]}
                  >
                    Executing...
                  </ThemedText>
                )}

                {tool.confidence !== undefined && tool.confidence < 0.85 && (
                  <View style={styles.confirmationRow}>
                    <Pressable
                      style={[
                        styles.confirmBtn,
                        { backgroundColor: theme.primary },
                      ]}
                      onPress={() => onConfirm?.(tool.toolName)}
                    >
                      <ThemedText
                        style={{ color: theme.buttonText, fontSize: 12 }}
                      >
                        Confirm
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.confirmBtn,
                        { backgroundColor: theme.error },
                      ]}
                      onPress={() => onReject?.(tool.toolName)}
                    >
                      <ThemedText
                        style={{ color: theme.buttonText, fontSize: 12 }}
                      >
                        Reject
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  toolCalls: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  toolCall: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
  },
  toolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  toolName: {
    fontSize: 12,
    fontWeight: "bold",
    flex: 1,
  },
  toolResult: {
    fontSize: 12,
    color: "#666",
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confirmationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  confirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
});
