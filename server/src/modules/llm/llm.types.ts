export type LlmProvider =
  | "replit"
  | "openai"
  | "google"
  | "groq"
  | "ollama"
  | "custom";

export interface LlmSettings {
  provider: LlmProvider;
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  available: boolean;
}
