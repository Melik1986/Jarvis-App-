import React, { useEffect, useCallback, useState } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import {
  GiftedChat,
  IMessage,
  Bubble,
  InputToolbar,
  Composer,
  Send,
  BubbleProps,
  InputToolbarProps,
  ComposerProps,
  SendProps,
} from "react-native-gifted-chat";

import { ThemedText } from "@/components/ThemedText";
import { VoiceButton } from "@/components/VoiceButton";
import { AnimatedMicIcon } from "@/components/AnimatedIcons";
import { useChatStore } from "@/store/chatStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

// Bot user for Jarvis
const JARVIS_USER = {
  _id: 2,
  name: "Jarvis",
  avatar: require("../../assets/images/icon.png"),
};

// Current user
const CURRENT_USER = {
  _id: 1,
  name: "User",
};

export default function ChatScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const {
    currentConversationId,
    isStreaming,
    streamingContent,
    setCurrentConversation,
    setStreaming,
    setStreamingContent,
    clearStreamingContent,
  } = useChatStore();

  // Create or load conversation on mount
  useEffect(() => {
    createOrLoadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update messages when streaming content changes
  useEffect(() => {
    if (isStreaming && streamingContent) {
      // Update the last message (streaming message) with new content
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const streamingMsgIndex = newMessages.findIndex(
          (m) => m._id === "streaming",
        );
        if (streamingMsgIndex >= 0) {
          newMessages[streamingMsgIndex] = {
            ...newMessages[streamingMsgIndex],
            text: streamingContent,
          };
        }
        return newMessages;
      });
    }
  }, [streamingContent, isStreaming]);

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

      // Show welcome message
      const welcomeMessage: IMessage = {
        _id: "welcome",
        text:
          t("welcomeMessage") ||
          "Привет! Я Jarvis, ваш AI-ассистент для 1С. Спросите меня об остатках, товарах или создании документов.",
        createdAt: new Date(),
        user: JARVIS_USER,
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      if (!currentConversationId || isStreaming) return;

      const userMessage = newMessages[0];

      // Add user message to state
      setMessages((prevMessages) =>
        GiftedChat.append(prevMessages, newMessages),
      );

      // Haptic feedback
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Start streaming
      setStreaming(true);
      setIsTyping(true);
      clearStreamingContent();

      // Add placeholder for streaming message
      const streamingPlaceholder: IMessage = {
        _id: "streaming",
        text: "",
        createdAt: new Date(),
        user: JARVIS_USER,
      };
      setMessages((prevMessages) =>
        GiftedChat.append(prevMessages, [streamingPlaceholder]),
      );

      try {
        const baseUrl = getApiUrl();
        const response = await fetch(
          `${baseUrl}api/conversations/${currentConversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: userMessage.text }),
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

              // Handle tool calls
              if (data.tool_call) {
                // Could show tool execution UI here
                console.log(`Tool called: ${data.tool_call}`);
              }

              // Handle content
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }

              // Handle completion
              if (data.done) {
                // Replace streaming placeholder with final message
                setMessages((prevMessages) => {
                  const newMessages = prevMessages.filter(
                    (m) => m._id !== "streaming",
                  );
                  const finalMessage: IMessage = {
                    _id: Date.now(),
                    text: fullContent,
                    createdAt: new Date(),
                    user: JARVIS_USER,
                  };
                  return GiftedChat.append(newMessages, [finalMessage]);
                });

                if (Platform.OS !== "web") {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                }
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        // Remove streaming placeholder on error
        setMessages((prevMessages) =>
          prevMessages.filter((m) => m._id !== "streaming"),
        );
      } finally {
        setStreaming(false);
        setIsTyping(false);
        clearStreamingContent();
      }
    },
    [
      currentConversationId,
      isStreaming,
      clearStreamingContent,
      setStreaming,
      setStreamingContent,
    ],
  );

  const handleVoicePress = () => {
    setIsRecording(!isRecording);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Custom bubble renderer
  const renderBubble = (props: BubbleProps<IMessage>) => (
    <Bubble
      {...props}
      wrapperStyle={{
        left: {
          backgroundColor: theme.backgroundSecondary,
          borderRadius: BorderRadius.lg,
          marginLeft: 0,
        },
        right: {
          backgroundColor: theme.primary,
          borderRadius: BorderRadius.lg,
        },
      }}
      textStyle={{
        left: { color: theme.text },
        right: { color: "#FFFFFF" },
      }}
    />
  );

  // Custom input toolbar
  const renderInputToolbar = (props: InputToolbarProps<IMessage>) => (
    <InputToolbar
      {...props}
      containerStyle={{
        backgroundColor: theme.backgroundRoot,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
      }}
    />
  );

  // Custom composer
  const renderComposer = (props: ComposerProps) => (
    <Composer
      {...props}
      textInputStyle={{
        color: theme.text,
        backgroundColor: theme.backgroundDefault,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        marginRight: Spacing.sm,
        borderWidth: 1,
        borderColor: theme.border,
      }}
      placeholderTextColor={theme.textTertiary}
      placeholder={t("messageJarvis") || "Сообщение Jarvis..."}
    />
  );

  // Custom send button
  const renderSend = (props: SendProps<IMessage>) => (
    <Send
      {...props}
      containerStyle={{
        justifyContent: "center",
        alignItems: "center",
        marginRight: Spacing.sm,
      }}
    >
      <View
        style={{
          backgroundColor: theme.primary,
          borderRadius: BorderRadius.full,
          padding: Spacing.sm,
        }}
      >
        <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
          {t("send") || "→"}
        </ThemedText>
      </View>
    </Send>
  );

  // Empty chat view
  const renderChatEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.micIconContainer}>
        <AnimatedMicIcon size={48} color={theme.primary} />
      </View>
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        {t("startConversation")}
      </ThemedText>
      <ThemedText
        style={[styles.emptySubtitle, { color: theme.textSecondary }]}
      >
        {t("askJarvis")}
      </ThemedText>
    </View>
  );

  // Footer with voice button
  const renderChatFooter = () => (
    <View
      style={[styles.voiceButtonContainer, { paddingBottom: tabBarHeight }]}
    >
      <VoiceButton
        isRecording={isRecording}
        onPress={handleVoicePress}
        disabled={isStreaming}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={CURRENT_USER}
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderComposer={renderComposer}
        renderSend={renderSend}
        renderChatEmpty={renderChatEmpty}
        renderChatFooter={renderChatFooter}
        isTyping={isTyping}
        alwaysShowSend
        scrollToBottom
        infiniteScroll
        inverted={true}
        listViewProps={{
          contentContainerStyle: {
            paddingTop: headerHeight,
            flexGrow: 1,
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
    transform: [{ scaleY: -1 }], // GiftedChat inverts the list
  },
  micIconContainer: {
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  voiceButtonContainer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
});
