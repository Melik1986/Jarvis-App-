import OpenAI from "openai";

export type LLMProvider = "replit" | "openai" | "groq" | "ollama" | "custom";

export interface LLMSettings {
  provider: LLMProvider;
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  available: boolean;
  unavailableReason?: string;
}

const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig | null> = {
  replit: {
    baseUrl:
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
      "https://api.openai.com/v1",
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
    defaultModel: "gpt-4o",
    available: true,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4o",
    available: true,
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: "",
    defaultModel: "llama-3.3-70b-versatile",
    available: true,
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "ollama", // Placeholder - Ollama typically doesn't require auth
    defaultModel: "llama3",
    available: true,
  },
  custom: {
    baseUrl: "",
    apiKey: "",
    defaultModel: "gpt-4o",
    available: true,
  },
};

export class LLMService {
  private getProviderConfig(settings: LLMSettings): ProviderConfig {
    const baseConfig = PROVIDER_CONFIGS[settings.provider];

    if (!baseConfig) {
      throw new Error(`Unknown LLM provider: ${settings.provider}`);
    }

    if (!baseConfig.available) {
      throw new Error(
        baseConfig.unavailableReason ||
          `Provider ${settings.provider} is not available`,
      );
    }

    return {
      baseUrl: settings.baseUrl || baseConfig.baseUrl,
      apiKey: settings.apiKey || baseConfig.apiKey,
      defaultModel: settings.modelName || baseConfig.defaultModel,
      available: baseConfig.available,
    };
  }

  createClient(settings: LLMSettings): OpenAI {
    const config = this.getProviderConfig(settings);

    // Replit and Ollama don't require API key (Ollama uses placeholder or no auth)
    if (
      !config.apiKey &&
      settings.provider !== "replit" &&
      settings.provider !== "ollama"
    ) {
      throw new Error(`API key is required for provider: ${settings.provider}`);
    }

    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  getModel(settings: LLMSettings): string {
    const config = this.getProviderConfig(settings);
    return settings.modelName || config.defaultModel;
  }

  isProviderAvailable(provider: LLMProvider): boolean {
    const config = PROVIDER_CONFIGS[provider];
    return config?.available ?? false;
  }

  getProviderInfo(provider: LLMProvider): {
    available: boolean;
    reason?: string;
  } {
    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      return { available: false, reason: "Unknown provider" };
    }
    return {
      available: config.available,
      reason: config.unavailableReason,
    };
  }

  getAvailableModels(provider: LLMProvider): string[] {
    switch (provider) {
      case "replit":
      case "openai":
        return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];
      case "groq":
        return [
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant",
          "mixtral-8x7b-32768",
          "gemma2-9b-it",
        ];
      case "ollama":
        return ["llama3", "mistral", "codellama", "phi3"];
      case "custom":
        return [];
      default:
        return [];
    }
  }
}

export const llmService = new LLMService();
