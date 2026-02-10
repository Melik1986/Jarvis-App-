import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ThemeMode } from "@/constants/theme";
import {
  createHybridStorage,
  SETTINGS_STD_PATHS,
  SETTINGS_HIGH_SEC_PATHS,
} from "@/lib/secure-settings-storage";

interface LLMSettings {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  transcriptionModel: string;
  provider: "replit" | "openai" | "ollama" | "groq" | "custom";
}

export type ERPProvider = "demo" | "1c" | "sap" | "odoo" | "custom";

interface ERPSettings {
  provider: ERPProvider;
  url: string;
  apiType: "rest" | "odata" | "graphql";
  username: string;
  password: string;
  apiKey: string;
  specUrl: string;
}

export type RagProvider = "qdrant" | "supabase" | "replit" | "none";

export interface RagSettings {
  provider: RagProvider;
  qdrant: {
    url: string;
    apiKey: string;
    collectionName: string;
  };
  supabase: {
    url: string;
    apiKey: string;
    tableName: string;
  };
  replit: {
    tableName: string;
  };
}

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface SettingsState {
  llm: LLMSettings;
  erp: ERPSettings;
  rag: RagSettings;
  mcpServers: McpServerConfig[];
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  language: string;
  theme: ThemeMode;
  setLLMSettings: (settings: Partial<LLMSettings>) => void;
  setERPSettings: (settings: Partial<ERPSettings>) => void;
  setRagSettings: (settings: Partial<RagSettings>) => void;
  setMcpServers: (servers: McpServerConfig[]) => void;
  setVoice: (voice: SettingsState["voice"]) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: ThemeMode) => void;
  resetToDefaults: () => void;
}

const defaultLLM: LLMSettings = {
  baseUrl: "",
  apiKey: "",
  modelName: "gpt-4o",
  transcriptionModel: "",
  provider: "replit",
};

const defaultERP: ERPSettings = {
  provider: "demo",
  url: "",
  apiType: "odata",
  username: "",
  password: "",
  apiKey: "",
  specUrl: "",
};

const defaultRag: RagSettings = {
  provider: "none",
  qdrant: {
    url: "",
    apiKey: "",
    collectionName: "kb_axon",
  },
  supabase: {
    url: "",
    apiKey: "",
    tableName: "documents",
  },
  replit: {
    tableName: "rag_documents",
  },
};

const defaultMcpServers: McpServerConfig[] = [];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llm: defaultLLM,
      erp: defaultERP,
      rag: defaultRag,
      mcpServers: defaultMcpServers,
      voice: "alloy",
      language: "system",
      theme: "system",
      setLLMSettings: (settings) =>
        set((state) => ({ llm: { ...state.llm, ...settings } })),
      setERPSettings: (settings) =>
        set((state) => ({ erp: { ...state.erp, ...settings } })),
      setRagSettings: (settings) =>
        set((state) => ({
          rag: {
            ...state.rag,
            ...settings,
            qdrant: { ...state.rag.qdrant, ...settings.qdrant },
            supabase: { ...state.rag.supabase, ...settings.supabase },
            replit: { ...state.rag.replit, ...settings.replit },
          },
        })),
      setMcpServers: (servers) => set({ mcpServers: servers }),
      setVoice: (voice) => set({ voice }),
      setLanguage: (language: string) => set({ language }),
      setTheme: (theme: ThemeMode) => set({ theme }),
      resetToDefaults: () =>
        set({
          llm: defaultLLM,
          erp: defaultERP,
          rag: defaultRag,
          mcpServers: defaultMcpServers,
          voice: "alloy",
          language: "ru",
          theme: "dark",
        }),
    }),
    {
      name: "jsrvis-settings",
      storage: createJSONStorage(() =>
        createHybridStorage(
          "jsrvis-settings",
          SETTINGS_STD_PATHS,
          "axon-settings-secrets",
          SETTINGS_HIGH_SEC_PATHS,
          "axon-settings-high-sec",
        ),
      ),
    },
  ),
);
