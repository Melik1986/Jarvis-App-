import { useCallback } from "react";
import { useChatStore, ChatMessage } from "@/store/chatStore";
import { getApiUrl } from "@/lib/query-client";

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
    setCurrentConversation,
    setStreaming,
    setStreamingContent,
    clearStreamingContent,
  } = useChatStore();

  /**
   * Send a message to Axon and get streaming response
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
        const baseUrl = getApiUrl();
        const response = await fetch(
          `${baseUrl}api/conversations/${currentConversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: question }),
          },
        );

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullResponse = "";

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
                fullResponse += data.content;
                setStreamingContent(fullResponse);
              }
              if (data.done) {
                // Add assistant message
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
        }

        return fullResponse;
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
    ],
  );

  /**
   * Create a new conversation
   */
  const newConversation = useCallback(
    async (title?: string): Promise<number> => {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "New Chat" }),
      });
      const conversation = await response.json();
      setCurrentConversation(conversation.id);
      setMessages([]);
      return conversation.id;
    },
    [setCurrentConversation, setMessages],
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
