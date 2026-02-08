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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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
import { useAuthStore } from "@/store/authStore";
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
  const getAccessToken = useAuthStore((state) => state.getAccessToken);

  const [inputText, setInputText] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`${baseUrl}api/conversations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: t("newChat") }),
      });
      const conversation = await response.json();
      setCurrentConversation(conversation.id);
    } catch (error) {
      AppLogger.error("Failed to create conversation:", error);
    }
  }, [t, setCurrentConversation, getAccessToken]);

  useEffect(() => {
    createOrLoadConversation();
  }, [createOrLoadConversation]);

  const sendMessage = useCallback(async () => {
    if (
      (!inputText.trim() && attachments.length === 0) ||
      !currentConversationId ||
      isStreaming
    )
      return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: inputText.trim(),
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

    try {
      const baseUrl = getApiUrl();
      const msgHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getAccessToken();
      if (token) {
        msgHeaders["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(
        `${baseUrl}api/conversations/${currentConversationId}/messages`,
        {
          method: "POST",
          headers: msgHeaders,
          body: JSON.stringify({
            content: userMessage.content,
            attachments: userMessage.attachments,
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

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = t("sendFailed");
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.details
            ? `${parsed.message}: ${parsed.details}`
            : parsed.message || errorMsg;
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

      for (const line of allLines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.error) {
            AppLogger.error("Stream error:", data.error);
            Alert.alert(t("error"), data.error);
            break;
          }

          if (data.content) {
            fullContent += data.content;
            setStreamingContent(fullContent);
          }
          if (data.toolCall) {
            toolCalls.push({ ...data.toolCall, status: "calling" });
          }
          if (data.toolResult) {
            const idx = toolCalls.findIndex(
              (t) =>
                t.toolName === data.toolResult.toolName &&
                t.status === "calling",
            );
            if (idx !== -1) {
              toolCalls[idx] = {
                ...toolCalls[idx],
                ...data.toolResult,
                status: "done",
              };
            } else {
              toolCalls.push({ ...data.toolResult, status: "done" });
            }
          }
          if (data.done) {
            const assistantMessage: ChatMessage = {
              id: Date.now() + 1,
              role: "assistant",
              content: fullContent,
              createdAt: new Date().toISOString(),
              toolCalls: toolCalls,
            };
            addMessage(assistantMessage);
            clearStreamingContent();
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
    } finally {
      setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputText,
    attachments,
    currentConversationId,
    isStreaming,
    getAccessToken,
  ]);

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

  const handleConfirmAction = (toolName: string) => {
    setInputText(`Confirm: ${toolName}`);
    // Optional: automatically send the message
    // setTimeout(sendMessage, 100);
  };

  const handleRejectAction = (toolName: string) => {
    setInputText(`Reject: ${toolName}`);
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
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64: string | undefined;

        try {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: "base64",
          });
        } catch (e) {
          AppLogger.warn("Failed to read document as base64", e);
        }

        const attachment: Attachment = {
          name: asset.name,
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

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble
        content={item.content}
        isUser={item.role === "user"}
        toolCalls={item.toolCalls}
        onConfirm={handleConfirmAction}
        onReject={handleRejectAction}
      />
    ),
    [],
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
              <View key={index} style={styles.attachmentPreview}>
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
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              multiline
              maxLength={2000}
            />
            {inputText.trim() || attachments.length > 0 ? (
              <Pressable
                style={styles.sendButton}
                onPress={sendMessage}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: Platform.OS === "android" ? 4 : 0,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
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
});
