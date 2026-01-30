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

interface ERPSettings {
  url: string;
  apiType: "rest" | "odata" | "graphql";
  apiKey: string;
  specUrl: string;
  preset: string;
}

interface SettingsState {
  llm: LLMSettings;
  erp: ERPSettings;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  language: string;
  theme: ThemeMode;
  setLLMSettings: (settings: Partial<LLMSettings>) => void;
  setERPSettings: (settings: Partial<ERPSettings>) => void;
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
  url: "",
  apiType: "rest",
  apiKey: "",
  specUrl: "",
  preset: "",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llm: defaultLLM,
      erp: defaultERP,
      voice: "alloy",
      language: "ru",
      theme: "dark",
      setLLMSettings: (settings) =>
        set((state) => ({ llm: { ...state.llm, ...settings } })),
      setERPSettings: (settings) =>
        set((state) => ({ erp: { ...state.erp, ...settings } })),
      setVoice: (voice) => set({ voice }),
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      resetToDefaults: () =>
        set({
          llm: defaultLLM,
          erp: defaultERP,
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
