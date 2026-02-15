import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ToolCall } from "@shared/types";

interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  onCopy?: (content: string) => void;
}

export function ChatBubble({
  content,
  isUser,
  isStreaming,
  toolCalls,
  onCopy,
}: ChatBubbleProps) {
  const { theme } = useTheme();
  const toolIndicators = React.useMemo(() => {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    const byToolName = new Map<string, { label: string; isDone: boolean }>();
    for (const tool of toolCalls) {
      const isDone = tool.status === "done" || !!tool.resultSummary;
      const normalizedToolName = tool.toolName.trim().toLowerCase();
      const existing = byToolName.get(normalizedToolName);

      if (!existing) {
        byToolName.set(normalizedToolName, {
          label: tool.toolName.trim(),
          isDone,
        });
        continue;
      }

      byToolName.set(normalizedToolName, {
        label: existing.label,
        isDone: existing.isDone || isDone,
      });
    }

    return Array.from(byToolName.values()).map((tool) => ({
      toolName: tool.label,
      isDone: tool.isDone,
    }));
  }, [toolCalls]);

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
            selectable={!isUser}
          >
            {content}
            {isStreaming ? "|" : ""}
          </ThemedText>
        ) : null}

        {!isUser && !isStreaming && content.trim().length > 0 && (
          <View style={styles.copyRow}>
            <Pressable
              style={styles.copyButton}
              onPress={() => onCopy?.(content)}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
            >
              <Ionicons
                name="copy-outline"
                size={13}
                color={theme.textSecondary}
              />
              <ThemedText
                style={[styles.copyText, { color: theme.textSecondary }]}
              >
                Copy
              </ThemedText>
            </Pressable>
          </View>
        )}

        {toolIndicators.length > 0 && (
          <View style={styles.toolIconsRow}>
            {toolIndicators.map((tool) => (
              <Ionicons
                key={tool.toolName}
                name="construct-outline"
                size={14}
                color={tool.isDone ? theme.primary : theme.textTertiary}
                style={styles.toolIcon}
              />
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
  copyRow: {
    marginTop: Spacing.xs,
    alignItems: "flex-end",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  copyText: {
    fontSize: 12,
    fontWeight: "500",
  },
  toolIconsRow: {
    marginTop: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  toolIcon: {
    opacity: 0.95,
  },
});
