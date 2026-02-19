import React, { useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActionSheetIOS,
  ScrollView,
  Clipboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, RouteProp } from "@react-navigation/native";
import type { ChatStackParamList } from "@/navigation/ChatStackNavigator";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import ImageViewerCompat from "@/components/ImageViewerCompat";

import { ThemedText } from "@/components/ThemedText";
import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { VoiceButton } from "@/components/VoiceButton";
import { AgentVisualizer, AgentState } from "@/components/AgentVisualizer";
import { useChatStore, ChatMessage } from "@/store/chatStore";
import type { ToolCall, Attachment } from "@shared/types";
import { useSettingsStore } from "@/store/settingsStore";
import { useSpendingStore } from "@/store/spendingStore";
// Auth handled by authenticatedFetch from query-client
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useVoice } from "@/hooks/useVoice";
import { Spacing, BorderRadius } from "@/constants/theme";
import { secureApiRequest } from "@/lib/query-client";
import type { EphemeralCredentials } from "@/lib/jwe-encryption";
import { localStore } from "@/lib/local-store";
import { AppLogger } from "@/lib/logger";
import { CHAT_CONFIG } from "@/config/chat.config";

async function performSummaryGeneration(
  convId: string,
  llmSettings: {
    provider: string;
    baseUrl: string;
    modelName: string;
    apiKey: string;
  },
) {
  const allMsgs = await localStore.getMessages(convId);
  if (allMsgs.length <= CHAT_CONFIG.RECENT_KEEP) return;

  const olderMsgs = allMsgs.slice(0, -CHAT_CONFIG.RECENT_KEEP);
  const existingSummary = await localStore.getConversationSummary(convId);

  const textToSummarize = olderMsgs
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join("\n");

  let prompt: string;
  if (existingSummary) {
    prompt = `Previous summary: ${existingSummary}\n\nNew messages to incorporate:\n${textToSummarize}\n\nUpdate the summary in 2-3 sentences.`;
  } else {
    prompt = `Summarize this conversation in 2-3 sentences:\n${textToSummarize}`;
  }

  const resp = await secureApiRequest(
    "POST",
    "chat",
    {
      content: prompt,
      history: [],
      llmSettings: {
        provider: llmSettings.provider,
        baseUrl: llmSettings.baseUrl,
        modelName: llmSettings.modelName,
      },
    },
    {
      llmKey: llmSettings.apiKey,
      llmProvider: llmSettings.provider,
      llmBaseUrl: llmSettings.baseUrl,
    } as EphemeralCredentials,
  );

  if (!resp.ok) return;
  const respText = await resp.text();
  let summaryText = "";
  for (const line of respText.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.content) summaryText += d.content;
    } catch {
      /* skip */
    }
  }

  if (summaryText.trim()) {
    await localStore.updateConversationSummary(convId, summaryText.trim());
  }
}

export default function ChatScreen() {
  "use no memo";
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const flatListRef = useRef<FlatList>(null);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const llmSettings = useSettingsStore((state) => state.llm);
  const erpSettings = useSettingsStore((state) => state.erp);
  const ragSettings = useSettingsStore((state) => state.rag);
  const incrementUsage = useSpendingStore((state) => state.incrementUsage);
  const incrementRequests = useSpendingStore(
    (state) => state.incrementRequests,
  );
  const mcpServers = useSettingsStore((state) => state.mcpServers);
  const mcpToolsHint =
    mcpServers.length > 0 ? `MCP tools: ${mcpServers.length}` : null;
  // Auth handled by authenticatedFetch

  const [inputText, setInputText] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const { isRecording, startRecording, stopRecording } = useVoice();

  const {
    messages,
    currentConversationId,
    isStreaming,
    streamingContent,
    addMessage,
    setCurrentConversation,
    setMessages,
    setStreaming,
    setStreamingContent,
    clearStreamingContent,
  } = useChatStore();

  const { createConversation, loadMessages } = useChatStore();
  const route = useRoute<RouteProp<ChatStackParamList, "Chat">>();
  const incomingConvId = route.params?.conversationId;

  const initConversation = useCallback(async () => {
    try {
      if (incomingConvId) {
        setCurrentConversation(incomingConvId);
        await loadMessages(incomingConvId);
        return;
      }

      if (currentConversationId) {
        await loadMessages(currentConversationId);
        return;
      }

      const existing = await localStore.listConversations();
      const firstConv = existing[0];
      if (firstConv) {
        setCurrentConversation(firstConv.id);
        await loadMessages(firstConv.id);
        return;
      }

      setMessages([]);
    } catch (error) {
      AppLogger.error("Failed to init conversation:", error);
    }
  }, [
    incomingConvId,
    currentConversationId,
    loadMessages,
    setCurrentConversation,
    setMessages,
  ]);

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  const generateSummary = useCallback(
    async (convId: string) => {
      try {
        await performSummaryGeneration(convId, llmSettings);
      } catch (e) {
        AppLogger.error("Summary generation failed", e);
      }
    },
    [llmSettings],
  );

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = overrideText ?? inputText;
      if ((!text.trim() && attachments.length === 0) || isStreaming) return;

      let conversationId = currentConversationId;
      if (!conversationId) {
        try {
          conversationId = await createConversation(t("newChat"));
          setCurrentConversation(conversationId);
        } catch (error) {
          AppLogger.error("Failed to create conversation:", error);
          Alert.alert(t("error"), t("sendFailed"));
          return;
        }
      }

      const userMessage: ChatMessage = {
        id: Date.now(),
        role: "user",
        content: text.trim(),
        createdAt: new Date().toISOString(),
        attachments: attachments,
      };

      addMessage(userMessage);
      setInputText("");
      setAttachments([]);
      setStreaming(true);
      clearStreamingContent();

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const userInstructions = llmSettings.userInstructions || undefined;
      const erpPassword = erpSettings.password || undefined;
      const erpApiKey = erpSettings.apiKey || undefined;

      try {
        // Read context from local SQLite for zero-storage payload
        const convId = conversationId;
        const [history, activeRules, enabledSkills, memoryFacts, convSummary] =
          await Promise.all([
            localStore.getRecentHistory(convId, CHAT_CONFIG.RECENT_WINDOW),
            localStore.getActiveRules(),
            localStore.getEnabledSkills(),
            localStore.getMemoryFacts(),
            localStore.getConversationSummary(convId),
          ]);

        const response = await secureApiRequest(
          "POST",
          "chat",
          {
            content: userMessage.content,
            attachments: userMessage.attachments,
            history,
            userInstructions,
            rules: activeRules.map((r) => ({
              id: r.id,
              name: r.name,
              condition: r.condition,
              action: r.action,
              message: r.message,
              content: r.content,
              priority: r.priority,
            })),
            skills: enabledSkills.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              code: s.code,
              content: s.content,
              inputSchema: s.inputSchema,
              outputSchema: s.outputSchema,
            })),
            llmSettings: {
              provider: llmSettings.provider,
              baseUrl: llmSettings.baseUrl,
              modelName: llmSettings.modelName,
            },
            erpSettings: {
              provider: erpSettings.provider,
              baseUrl: erpSettings.url,
              db: erpSettings.db,
              username: erpSettings.username,
              apiType: erpSettings.apiType,
              openApiSpecUrl: erpSettings.specUrl,
            },
            ragSettings: {
              provider: ragSettings.provider,
              qdrant: ragSettings.qdrant,
            },
            mcpServers: mcpServers.map((server) => ({
              name: server.name,
              command: server.command,
              args: server.args,
              env: server.env,
            })),
            conversationSummary: convSummary,
            memoryFacts: memoryFacts.map((f) => ({
              key: f.key,
              value: f.value,
            })),
          },
          {
            llmKey: llmSettings.apiKey,
            llmProvider: llmSettings.provider,
            llmBaseUrl: llmSettings.baseUrl,
            erpProvider: erpSettings.provider,
            erpBaseUrl: erpSettings.url,
            erpApiType: erpSettings.apiType,
            erpDb: erpSettings.db,
            erpUsername: erpSettings.username,
            erpPassword: erpPassword,
            erpApiKey: erpApiKey,
          } as EphemeralCredentials,
        );

        if (!response.ok) {
          const errorBody = await response.text();
          let errorMsg = t("sendFailed");
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed.details) {
              errorMsg = `${parsed.message}: ${parsed.details}`;
            } else if (parsed.message) {
              errorMsg = parsed.message;
            }
          } catch {
            /* non-JSON error */
          }
          AppLogger.error("Chat API error:", errorBody);
          Alert.alert(t("error"), errorMsg);
          return;
        }

        const responseText = await response.text();
        const allLines = responseText.split("\n");
        let fullContent = "";
        const toolCalls: ToolCall[] = [];
        let usageCounted = false;

        for (const line of allLines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              AppLogger.error("Stream error:", data.error);
              Alert.alert(t("error"), data.error);
              break;
            }

            if (data.type === "usage") {
              if (data.usage) {
                let totalTokens = 0;
                if (data.usage.totalTokens != null) {
                  totalTokens = Number(data.usage.totalTokens);
                }
                if (totalTokens > 0) {
                  incrementUsage(totalTokens);
                }
                incrementRequests();
                usageCounted = true;
                continue;
              }
            }

            if (data.content) {
              fullContent += data.content;
              setStreamingContent(fullContent);
            }
            if (data.toolCall) {
              toolCalls.push({ ...data.toolCall, status: "calling" });
            }
            if (data.toolResult) {
              const idx = toolCalls.findIndex((t) => {
                if (t.toolName !== data.toolResult.toolName) return false;
                return t.status === "calling";
              });
              if (idx !== -1) {
                toolCalls[idx] = {
                  ...toolCalls[idx],
                  ...data.toolResult,
                  status: "done",
                };
              } else {
                toolCalls.push({ ...data.toolResult, status: "done" });
              }

              // Handle save_memory tool: persist fact to local SQLite
              if (data.toolResult.toolName === "save_memory") {
                try {
                  let result = data.toolResult.result;
                  if (typeof data.toolResult.result === "string") {
                    result = JSON.parse(data.toolResult.result);
                  }
                  if (result) {
                    if (result._action === "save_memory") {
                      localStore
                        .saveMemoryFact(result.key, result.value, convId)
                        .catch((e) =>
                          AppLogger.error("Failed to save memory fact", e),
                        );
                    }
                  }
                } catch {
                  /* non-JSON result, skip */
                }
              }
            }
            if (data.done) {
              if (!usageCounted) {
                incrementRequests();
              }

              const textContent = fullContent.trim();
              const toolCallsByName = new Map<string, ToolCall>();
              for (const toolCall of toolCalls) {
                const normalizedToolName = toolCall.toolName
                  .trim()
                  .toLowerCase();
                const existing = toolCallsByName.get(normalizedToolName);

                if (!existing) {
                  toolCallsByName.set(normalizedToolName, toolCall);
                  continue;
                }

                let existingDone = existing.status === "done";
                if (!existingDone) {
                  if (existing.resultSummary) {
                    existingDone = true;
                  }
                }
                let currentDone = toolCall.status === "done";
                if (!currentDone) {
                  if (toolCall.resultSummary) {
                    currentDone = true;
                  }
                }

                if (!existingDone) {
                  if (currentDone) {
                    toolCallsByName.set(normalizedToolName, {
                      ...existing,
                      ...toolCall,
                    });
                  }
                }
              }
              const uniqueToolCalls = Array.from(toolCallsByName.values());

              let messageContent = textContent;
              if (!messageContent) {
                messageContent = t("completed");
              }
              const assistantMessage: ChatMessage = {
                id: Date.now() + 1,
                role: "assistant",
                content: messageContent,
                createdAt: new Date().toISOString(),
                toolCalls: uniqueToolCalls,
              };
              addMessage(assistantMessage);
              clearStreamingContent();

              // Auto-title: update from "New Chat" after first exchange
              if (messages.length <= 1) {
                let titleSuffix = "";
                if (userMessage.content.length > 40) {
                  titleSuffix = "...";
                }
                const title = userMessage.content.slice(0, 40) + titleSuffix;
                localStore
                  .updateConversationTitle(convId, title)
                  .catch(() => {});
              }

              // Auto-summarize: update summary every N new messages after threshold
              const totalMsgs = messages.length + 2; // +user +assistant just added
              if (totalMsgs >= CHAT_CONFIG.SUMMARY_MIN_MESSAGES) {
                if (totalMsgs % CHAT_CONFIG.SUMMARY_FREQUENCY < 2) {
                  generateSummary(convId).catch(() => {});
                }
              }

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              }
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            AppLogger.warn("SSE parse error:", parseErr);
          }
        }
      } catch (error) {
        AppLogger.error("Failed to send message:", error);
        Alert.alert(t("error"), t("sendFailed"));
      }
      setStreaming(false);
    },
    [
      inputText,
      attachments,
      currentConversationId,
      isStreaming,
      mcpServers,
      addMessage,
      createConversation,
      clearStreamingContent,
      setCurrentConversation,
      setStreaming,
      setStreamingContent,
      messages.length,
      llmSettings.provider,
      llmSettings.baseUrl,
      llmSettings.apiKey,
      llmSettings.modelName,
      llmSettings.userInstructions,
      erpSettings.provider,
      erpSettings.url,
      erpSettings.db,
      erpSettings.username,
      erpSettings.password,
      erpSettings.apiKey,
      erpSettings.apiType,
      erpSettings.specUrl,
      ragSettings.provider,
      ragSettings.qdrant,
      generateSummary,
      incrementUsage,
      incrementRequests,
      t,
    ],
  );

  const handleVoicePress = async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result?.userTranscript) {
        setInputText(result.userTranscript);
      }
    } else {
      await startRecording();
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.5,
        base64: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset) return;
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 512 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        const attachment: Attachment = {
          name: `Photo ${new Date().toLocaleTimeString()}`,
          type: "image",
          mimeType: "image/jpeg",
          uri: compressed.uri,
          base64: compressed.base64 || undefined,
        };
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (error) {
      AppLogger.error("Camera error:", error);
    }
  };

  const handleImageLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.5,
        base64: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset) return;
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 512 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        const attachment: Attachment = {
          name: asset.fileName || "Image",
          type: "image",
          mimeType: "image/jpeg",
          uri: compressed.uri,
          base64: compressed.base64 || undefined,
        };
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (error) {
      AppLogger.error("Image library error:", error);
    }
  };

  const handleDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      const asset =
        !result.canceled && result.assets?.length
          ? result.assets[0]
          : undefined;
      if (asset) {
        let base64: string | undefined;

        try {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: "base64",
          });
        } catch (e) {
          AppLogger.warn("Failed to read document as base64", e);
        }

        const attachment: Attachment = {
          name: asset.name ?? "document",
          type: "file",
          mimeType: asset.mimeType || "application/octet-stream",
          uri: asset.uri,
          base64,
        };
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (error) {
      AppLogger.error("Document picker error:", error);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImagePress = (index: number) => {
    setCurrentImageIndex(index);
    setIsPreviewVisible(true);
  };

  const handleAttach = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const options = [
      t("cancel"),
      t("camera"),
      t("photoLibrary"),
      t("document"),
    ];
    const cancelButtonIndex = 0;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleCamera();
          else if (buttonIndex === 2) handleImageLibrary();
          else if (buttonIndex === 3) handleDocument();
        },
      );
    } else {
      Alert.alert(t("addAttachment"), t("chooseSource"), [
        { text: t("camera"), onPress: handleCamera },
        { text: t("photoLibrary"), onPress: handleImageLibrary },
        { text: t("document"), onPress: handleDocument },
        { text: t("cancel"), style: "cancel" },
      ]);
    }
  };

  const { forkConversation, removeLastAssistantMessage } = useChatStore();

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

  const handleRegenerate = useCallback(async () => {
    if (isStreaming || messages.length < 2) return;
    // Find last user message
    let lastUserMsg: ChatMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === "user") {
        lastUserMsg = msg;
        break;
      }
    }
    if (!lastUserMsg) return;
    await removeLastAssistantMessage();
    // Auto-send the last user message to regenerate the response
    await sendMessage(lastUserMsg.content);
  }, [isStreaming, messages, removeLastAssistantMessage, sendMessage]);

  const handleFork = useCallback(
    async (localId: string) => {
      try {
        const newConvId = await forkConversation(localId);
        AppLogger.info(`Forked conversation: ${newConvId}`);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        AppLogger.error("Fork failed", e);
      }
    },
    [forkConversation],
  );

  const handleMessageLongPress = useCallback(
    (item: ChatMessage) => {
      const localId = item._localId ?? String(item.id);
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [t("cancel"), t("forkFromHere") || "Fork from here"],
            cancelButtonIndex: 0,
          },
          (idx) => {
            if (idx === 1) void handleFork(localId);
          },
        );
      } else {
        Alert.alert(
          t("forkFromHere") || "Fork from here",
          t("forkDescription") || "Create a new conversation from this point?",
          [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("fork") || "Fork",
              onPress: () => void handleFork(localId),
            },
          ],
        );
      }
    },
    [handleFork, t],
  );

  const handleCopyMessage = useCallback((content: string) => {
    const text = content.trim();
    if (!text) return;
    Clipboard.setString(text);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isLastAssistant =
        item.role === "assistant" &&
        index === allMessages.length - 1 &&
        !isStreaming;

      return (
        <Pressable
          onLongPress={
            item.role === "user"
              ? () => handleMessageLongPress(item)
              : undefined
          }
        >
          <ChatBubble
            content={item.content}
            isUser={item.role === "user"}
            toolCalls={item.toolCalls}
            onCopy={handleCopyMessage}
          />
          {isLastAssistant && (
            <Pressable style={styles.regenerateBtn} onPress={handleRegenerate}>
              <Ionicons name="refresh" size={14} color={theme.textTertiary} />
              <ThemedText
                style={[styles.regenerateText, { color: theme.textTertiary }]}
              >
                {t("regenerate") || "Regenerate"}
              </ThemedText>
            </Pressable>
          )}
        </Pressable>
      );
    },
    [
      allMessages.length,
      isStreaming,
      theme,
      t,
      handleMessageLongPress,
      handleRegenerate,
      handleCopyMessage,
    ],
  );

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const agentState: AgentState = isRecording
    ? "listening"
    : isStreaming
      ? "speaking"
      : "idle";

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState title={t("startConversation")} subtitle={t("askJarvis")}>
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
  };

  const images = attachments
    .filter((att) => att.type === "image")
    .map((att) => ({ uri: att.uri }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.backgroundVisualizer} pointerEvents="none">
        <AgentVisualizer
          state={agentState}
          size={200}
          color={theme.primary}
          volume={isRecording ? 0.6 : 0}
        />
      </View>

      <FlatList
        ref={flatListRef}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight,
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

      {mcpToolsHint ? (
        <View style={styles.mcpHint}>
          <ThemedText
            style={[styles.mcpHintText, { color: theme.textTertiary }]}
          >
            {mcpToolsHint}
          </ThemedText>
        </View>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom:
              Math.max(insets.bottom, Spacing.md) +
              (Platform.OS === "android" ? 70 : 40),
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        {attachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.attachmentsContainer}
            contentContainerStyle={styles.attachmentsContent}
          >
            {attachments.map((att, index) => (
              <View key={att.uri} style={styles.attachmentPreview}>
                {att.type === "image" ? (
                  <Pressable
                    style={styles.attachmentImageContainer}
                    onPress={() => handleImagePress(index)}
                  >
                    <Image
                      source={{ uri: att.uri }}
                      style={styles.attachmentImage}
                      contentFit="cover"
                    />
                  </Pressable>
                ) : (
                  <View
                    style={[
                      styles.attachmentFile,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Ionicons
                      name="document-text"
                      size={24}
                      color={theme.primary}
                    />
                  </View>
                )}
                <Pressable
                  style={[
                    styles.removeAttachment,
                    { backgroundColor: theme.backgroundRoot },
                  ]}
                  onPress={() => handleRemoveAttachment(index)}
                >
                  <Ionicons name="close" size={12} color={theme.text} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={styles.inputRow}>
          <Pressable
            style={styles.attachButton}
            onPress={handleAttach}
            disabled={isStreaming}
          >
            <Ionicons name="add" size={28} color={theme.textSecondary} />
          </Pressable>
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
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              multiline
              maxLength={2000}
            />
            {inputText.trim() || attachments.length > 0 ? (
              <Pressable
                style={styles.sendButton}
                onPress={() => sendMessage()}
                disabled={isStreaming}
              >
                <Ionicons name="send" size={20} color={theme.primary} />
              </Pressable>
            ) : (
              <View style={{ marginRight: -4 }}>
                <VoiceButton
                  isRecording={isRecording}
                  onPress={handleVoicePress}
                  disabled={isStreaming}
                  size={40}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      <ImageViewerCompat
        images={images}
        imageIndex={currentImageIndex}
        visible={isPreviewVisible}
        onRequestClose={() => setIsPreviewVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundVisualizer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: "20%",
    zIndex: 0,
    opacity: 0.15,
  },
  list: {
    flex: 1,
    zIndex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyListContent: {
    justifyContent: "flex-end",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: Spacing.xl,
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
  mcpHint: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  mcpHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: Platform.OS === "android" ? 4 : 0,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 48,
    maxHeight: 160,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 140,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    textAlignVertical: "top",
  },
  sendButton: {
    padding: Spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceButtonExternal: {
    marginLeft: Spacing.sm,
    marginBottom: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  voiceButtonContainer: {
    display: "none",
  },
  attachButton: {
    padding: Spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.xs,
  },
  attachmentsContainer: {
    maxHeight: 80,
    marginBottom: Spacing.sm,
  },
  attachmentsContent: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  attachmentPreview: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  attachmentImageContainer: {
    width: "100%",
    height: "100%",
  },
  attachmentImage: {
    width: "100%",
    height: "100%",
  },
  attachmentFile: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  removeAttachment: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  regenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: Spacing.md,
    marginTop: 4,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    opacity: 0.7,
  },
  regenerateText: {
    fontSize: 12,
    marginLeft: 4,
  },
});
