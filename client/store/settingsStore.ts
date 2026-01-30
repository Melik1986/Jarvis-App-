import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeMode } from "@/constants/theme";

interface LLMSettings {
  baseUrl: string;
  apiKey: string;
  modelName: string;
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

export type RagProvider = "qdrant" | "none";

export interface RagSettings {
  provider: RagProvider;
  qdrant: {
    url: string;
    apiKey: string;
    collectionName: string;
  };
}

interface SettingsState {
  llm: LLMSettings;
  erp: ERPSettings;
  rag: RagSettings;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  language: string;
  theme: ThemeMode;
  setLLMSettings: (settings: Partial<LLMSettings>) => void;
  setERPSettings: (settings: Partial<ERPSettings>) => void;
  setRagSettings: (settings: Partial<RagSettings>) => void;
  setVoice: (voice: SettingsState["voice"]) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: ThemeMode) => void;
  resetToDefaults: () => void;
}

const defaultLLM: LLMSettings = {
  baseUrl: "",
  apiKey: "",
  modelName: "gpt-4o",
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
    collectionName: "kb_jarvis",
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llm: defaultLLM,
      erp: defaultERP,
      rag: defaultRag,
      voice: "alloy",
      language: "ru",
      theme: "dark",
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
          },
        })),
      setVoice: (voice) => set({ voice }),
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      resetToDefaults: () =>
        set({
          llm: defaultLLM,
          erp: defaultERP,
          rag: defaultRag,
          voice: "alloy",
          language: "ru",
          theme: "dark",
        }),
    }),
    {
      name: "jsrvis-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
