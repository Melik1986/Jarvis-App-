import { useCallback } from "react";
import { useChatStore, ChatMessage } from "@/store/chatStore";
import { apiRequest } from "@/lib/query-client";
import { localStore } from "@/lib/local-store";
import { useSettingsStore } from "@/store/settingsStore";
import {
  getUserFriendlyMessage,
  logError,
  parseApiError,
} from "@/lib/error-handler";

/**
 * Hook for interacting with Axon AI assistant.
 * Provides methods to send messages and manage chat state.
 */
export function useAxon() {
  const {
    messages,
    currentConversationId,
    isStreaming,
    streamingContent,
    setMessages,
    addMessage,
    setStreaming,
    setStreamingContent,
    clearStreamingContent,
  } = useChatStore();

  const mcpServers = useSettingsStore((state) => state.mcpServers);
  const llmSettings = useSettingsStore((state) => state.llm);

  /**
   * Send a message to Axon and get streaming response.
   * Sends history + rules + skills in payload (zero-storage).
   */
  const ask = useCallback(
    async (question: string): Promise<string> => {
      if (!currentConversationId || isStreaming) {
        throw new Error(
          "Cannot send message: no conversation or already streaming",
        );
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now(),
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      };
      addMessage(userMessage);

      setStreaming(true);
      clearStreamingContent();

      try {
        // Read context from local SQLite for the payload
        const [history, activeRules, enabledSkills] = await Promise.all([
          localStore.getRecentHistory(currentConversationId, 20),
          localStore.getActiveRules(),
          localStore.getEnabledSkills(),
        ]);

        const response = await apiRequest("POST", "/api/chat", {
          content: question,
          history,
          userInstructions: llmSettings.userInstructions || undefined,
          rules: activeRules.map((r) => ({
            id: r.id,
            name: r.name,
            condition: r.condition,
            action: r.action,
            message: r.message,
            priority: r.priority,
          })),
          skills: enabledSkills.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            code: s.code,
            inputSchema: s.inputSchema,
            outputSchema: s.outputSchema,
          })),
          llmSettings: {
            provider: llmSettings.provider,
            baseUrl: llmSettings.baseUrl,
            apiKey: llmSettings.apiKey,
            modelName: llmSettings.modelName,
          },
          mcpServers,
        });

        const responseText = await response.text();
        const lines = responseText.split("\n");
        let fullResponse = "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullResponse += data.content;
              setStreamingContent(fullResponse);
            }
            if (data.done) {
              const assistantMessage: ChatMessage = {
                id: Date.now() + 1,
                role: "assistant",
                content: fullResponse,
                createdAt: new Date().toISOString(),
              };
              addMessage(assistantMessage);
            }
          } catch {
            // Ignore parse errors
          }
        }

        return fullResponse;
      } catch (error) {
        // Log error with context
        logError(error, "useAxon.ask", {
          conversationId: currentConversationId,
          questionLength: question.length,
        });

        // Parse error and get user-friendly message
        const apiError = parseApiError(error);
        const friendlyMessage = getUserFriendlyMessage(apiError);

        // Throw user-friendly error
        throw new Error(friendlyMessage);
      } finally {
        setStreaming(false);
        clearStreamingContent();
      }
    },
    [
      currentConversationId,
      isStreaming,
      addMessage,
      clearStreamingContent,
      setStreaming,
      setStreamingContent,
      mcpServers,
      llmSettings,
    ],
  );

  /**
   * Create a new conversation locally (SQLite, no server call)
   */
  const newConversation = useCallback(
    async (title?: string): Promise<string> => {
      const id = await useChatStore
        .getState()
        .createConversation(title || "New Chat");
      setMessages([]);
      return id;
    },
    [setMessages],
  );

  /**
   * Clear current conversation messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    clearStreamingContent();
  }, [setMessages, clearStreamingContent]);

  return {
    // State
    messages,
    isStreaming,
    streamingContent,
    currentConversationId,

    // Actions
    ask,
    newConversation,
    clearMessages,
  };
}
