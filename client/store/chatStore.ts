import { create } from "zustand";
import type { ChatMessage, Conversation } from "@shared/types";
import { localStore } from "@/lib/local-store";
import { AppLogger } from "@/lib/logger";

export type { ChatMessage, Conversation } from "@shared/types";

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;

  /** Load conversations from local SQLite */
  loadConversations: () => Promise<void>;
  /** Create conversation locally (SQLite) */
  createConversation: (title: string) => Promise<string>;
  /** Delete conversation locally (SQLite) */
  deleteConversation: (id: string) => Promise<void>;
  /** Load messages for a conversation from SQLite */
  loadMessages: (conversationId: string) => Promise<void>;

  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  /** Add message to in-memory + persist to SQLite */
  addMessage: (message: ChatMessage) => void;
  /** Fork conversation up to a specific message */
  forkConversation: (messageId: string) => Promise<string>;
  /** Remove last assistant message (for regenerate) */
  removeLastAssistantMessage: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: "",

  loadConversations: async () => {
    try {
      const rows = await localStore.listConversations();
      set({
        conversations: rows.map((r) => ({
          id: Number(r.id) || 0,
          title: r.title,
          createdAt: new Date(r.createdAt).toISOString(),
          _localId: r.id,
        })) as unknown as Conversation[],
      });
    } catch (e) {
      AppLogger.error("loadConversations failed", e);
    }
  },

  createConversation: async (title: string) => {
    const conv = await localStore.createConversation(title);
    set({ currentConversationId: conv.id, messages: [] });
    return conv.id;
  },

  deleteConversation: async (id: string) => {
    await localStore.deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter(
        (c) =>
          (c as unknown as { _localId?: string })._localId !== id &&
          String(c.id) !== id,
      ),
    }));
  },

  loadMessages: async (conversationId: string) => {
    try {
      const rows = await localStore.getMessages(conversationId);
      set({
        messages: rows.map((r, idx) => ({
          id: idx + 1,
          _localId: r.id,
          role: r.role,
          content: r.content,
          createdAt: new Date(r.createdAt).toISOString(),
          attachments: r.attachments ? JSON.parse(r.attachments) : undefined,
          metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        })) as ChatMessage[],
      });
    } catch (e) {
      AppLogger.error("loadMessages failed", e);
    }
  },

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    // Persist to SQLite and update _localId
    const convId = get().currentConversationId;
    if (convId) {
      localStore
        .addMessage(
          convId,
          message.role,
          message.content,
          message.attachments,
          message.metadata,
        )
        .then((saved) => {
          // Patch _localId so fork can find the message by SQLite UUID
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === message.id && m.role === message.role
                ? { ...m, _localId: saved.id }
                : m,
            ),
          }));
        })
        .catch((e) => AppLogger.error("addMessage persist failed", e));
    }
  },

  forkConversation: async (messageId: string) => {
    const convId = get().currentConversationId;
    if (!convId) throw new Error("No current conversation");
    const forked = await localStore.forkConversation(convId, messageId);
    set({ currentConversationId: forked.id });
    // Reload messages for the forked conversation
    const rows = await localStore.getMessages(forked.id);
    set({
      messages: rows.map((r, idx) => ({
        id: idx + 1,
        _localId: r.id,
        role: r.role,
        content: r.content,
        createdAt: new Date(r.createdAt).toISOString(),
        attachments: r.attachments ? JSON.parse(r.attachments) : undefined,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      })) as ChatMessage[],
    });
    return forked.id;
  },

  removeLastAssistantMessage: async () => {
    const convId = get().currentConversationId;
    if (!convId) return;
    await localStore.deleteLastAssistantMessage(convId);
    // Remove from in-memory state
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i];
        if (msg && msg.role === "assistant") {
          msgs.splice(i, 1);
          break;
        }
      }
      return { messages: msgs };
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  clearStreamingContent: () => set({ streamingContent: "" }),
}));
