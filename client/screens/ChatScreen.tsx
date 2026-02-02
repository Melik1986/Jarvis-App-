import React, { useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { VoiceButton } from "@/components/VoiceButton";
import { useChatStore, ChatMessage } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useVoice } from "@/hooks/useVoice";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { AppLogger } from "@/lib/logger";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const flatListRef = useRef<FlatList>(null);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const llmSettings = useSettingsStore((state) => state.llm);
  const erpSettings = useSettingsStore((state) => state.erp);
  const ragSettings = useSettingsStore((state) => state.rag);

  const [inputText, setInputText] = React.useState("");
  const { isRecording, startRecording, stopRecording, transcription } =
    useVoice();

  useEffect(() => {
    if (transcription) {
      setInputText(transcription);
    }
  }, [transcription]);

  const {
    messages,
    currentConversationId,
    isStreaming,
    streamingContent,
    addMessage,
    setCurrentConversation,
    setStreaming,
    setStreamingContent,
    clearStreamingContent,
  } = useChatStore();

  const createOrLoadConversation = React.useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t("newChat") }),
      });
      const conversation = await response.json();
      setCurrentConversation(conversation.id);
    } catch (error) {
      AppLogger.error("Failed to create conversation:", error);
    }
  }, [t, setCurrentConversation]);

  useEffect(() => {
    createOrLoadConversation();
  }, [createOrLoadConversation]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !currentConversationId || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: inputText.trim(),
      createdAt: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInputText("");
    setStreaming(true);
    clearStreamingContent();

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        `${baseUrl}api/conversations/${currentConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: userMessage.content,
            llmSettings: {
              provider: llmSettings.provider,
              baseUrl: llmSettings.baseUrl,
              apiKey: llmSettings.apiKey,
              modelName: llmSettings.modelName,
            },
            erpSettings: {
              provider: erpSettings.provider,
              baseUrl: erpSettings.url,
              username: erpSettings.username,
              password: erpSettings.password,
              apiKey: erpSettings.apiKey,
              apiType: erpSettings.apiType,
            },
            ragSettings: {
              provider: ragSettings.provider,
              qdrant: ragSettings.qdrant,
            },
          }),
        },
      );

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullContent += data.content;
              setStreamingContent(fullContent);
            }
            if (data.done) {
              const assistantMessage: ChatMessage = {
                id: Date.now() + 1,
                role: "assistant",
                content: fullContent,
                createdAt: new Date().toISOString(),
              };
              addMessage(assistantMessage);
              clearStreamingContent();
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              }
            }
          } catch {}
        }
      }
    } catch (error) {
      AppLogger.error("Failed to send message:", error);
    } finally {
      setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, currentConversationId, isStreaming]);

  const handleVoicePress = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble content={item.content} isUser={item.role === "user"} />
    ),
    [],
  );

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <EmptyState
        image={require("../../assets/images/icon.png")}
        imageStyle={{ borderRadius: 80, opacity: 1 }}
        title={t("startConversation")}
        subtitle={t("askJarvis")}
      >
        <View style={styles.suggestions}>
          <Pressable
            style={({ pressed }) => [
              styles.suggestionChip,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
              pressed && {
                backgroundColor: theme.primary + "20",
                borderColor: theme.primary,
              },
            ]}
            onPress={() => handleSuggestionPress(t("checkInventory"))}
          >
            <ThemedText
              style={[styles.suggestionText, { color: theme.textSecondary }]}
            >
              {t("checkInventory")}
            </ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.suggestionChip,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
              pressed && {
                backgroundColor: theme.primary + "20",
                borderColor: theme.primary,
              },
            ]}
            onPress={() => handleSuggestionPress(t("createInvoice"))}
          >
            <ThemedText
              style={[styles.suggestionText, { color: theme.textSecondary }]}
            >
              {t("createInvoice")}
            </ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.suggestionChip,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
              pressed && {
                backgroundColor: theme.primary + "20",
                borderColor: theme.primary,
              },
            ]}
            onPress={() => handleSuggestionPress(t("showSalesReport"))}
          >
            <ThemedText
              style={[styles.suggestionText, { color: theme.textSecondary }]}
            >
              {t("showSalesReport")}
            </ThemedText>
          </Pressable>
        </View>
      </EmptyState>
    </View>
  );

  const allMessages =
    isStreaming && streamingContent
      ? [
          ...messages,
          {
            id: -1,
            role: "assistant" as const,
            content: streamingContent,
            createdAt: "",
          },
        ]
      : messages;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <FlatList
        ref={flatListRef}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + 100,
          },
          messages.length === 0 && styles.emptyListContent,
        ]}
        data={allMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      />

      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: insets.bottom + Spacing.lg,
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <View style={styles.inputRow}>
          <View
            style={[
              styles.textInputContainer,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder={t("messageJarvis")}
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              multiline
              maxLength={2000}
            />
            <Pressable
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isStreaming}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? theme.primary : theme.textTertiary}
              />
            </Pressable>
          </View>
        </View>
        <View style={styles.voiceButtonContainer}>
          <VoiceButton
            isRecording={isRecording}
            onPress={handleVoicePress}
            disabled={isStreaming}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyListContent: {
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: Spacing.xs,
  },
  sendButton: {
    padding: Spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  voiceButtonContainer: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
