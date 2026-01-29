import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, FlatList, TextInput, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";

import { AnimatedSendIcon } from "@/components/AnimatedIcons";

import { ThemedText } from "@/components/ThemedText";
import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { VoiceButton } from "@/components/VoiceButton";
import { useChatStore, ChatMessage } from "@/store/chatStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = React.useState("");
  const [isRecording, setIsRecording] = React.useState(false);

  const {
    messages,
    currentConversationId,
    isStreaming,
    streamingContent,
    setMessages,
    addMessage,
    setCurrentConversation,
    setStreaming,
    setStreamingContent,
    appendStreamingContent,
    clearStreamingContent,
  } = useChatStore();

  useEffect(() => {
    createOrLoadConversation();
  }, []);

  const createOrLoadConversation = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const conversation = await response.json();
      setCurrentConversation(conversation.id);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

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
          body: JSON.stringify({ content: userMessage.content }),
        }
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
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setStreaming(false);
    }
  }, [inputText, currentConversationId, isStreaming]);

  const handleVoicePress = () => {
    setIsRecording(!isRecording);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble content={item.content} isUser={item.role === "user"} />
    ),
    []
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
        image={require("../../assets/images/empty-chat.png")}
        title="Start a conversation"
        subtitle="Ask Jarvis anything about your business data"
      >
        <View style={styles.suggestions}>
          <Pressable 
            style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
            onPress={() => handleSuggestionPress("Check inventory stock")}
          >
            <ThemedText style={styles.suggestionText}>Check inventory stock</ThemedText>
          </Pressable>
          <Pressable 
            style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
            onPress={() => handleSuggestionPress("Create new invoice")}
          >
            <ThemedText style={styles.suggestionText}>Create new invoice</ThemedText>
          </Pressable>
          <Pressable 
            style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
            onPress={() => handleSuggestionPress("Show sales report")}
          >
            <ThemedText style={styles.suggestionText}>Show sales report</ThemedText>
          </Pressable>
        </View>
      </EmptyState>
    </View>
  );

  const allMessages = isStreaming && streamingContent
    ? [...messages, { id: -1, role: "assistant" as const, content: streamingContent, createdAt: "" }]
    : messages;

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}>
      <FlatList
        ref={flatListRef}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + 100 },
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
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
      >
        <View style={styles.inputRow}>
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Message Jarvis..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              multiline
              maxLength={2000}
            />
            <Pressable
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isStreaming}
            >
              <AnimatedSendIcon
                size={20}
                color={inputText.trim() ? Colors.dark.primary : Colors.dark.textTertiary}
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
    </View>
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
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  suggestionChipPressed: {
    backgroundColor: Colors.dark.primary + "20",
    borderColor: Colors.dark.primary,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  inputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.dark.backgroundRoot,
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
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
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
