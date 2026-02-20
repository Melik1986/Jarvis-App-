import { Injectable, Inject } from "@nestjs/common";
import { createOpenAI } from "@ai-sdk/openai";
import { AppLogger } from "../../utils/logger";
import { LlmSettings } from "../llm/llm.types";
import { OutboundUrlPolicy } from "../../security/outbound-url-policy";

@Injectable()
export class LlmProviderFactory {
  constructor(
    @Inject(OutboundUrlPolicy)
    private readonly outboundUrlPolicy: OutboundUrlPolicy,
  ) {}

  /**
   * Create Vercel AI SDK provider based on LLM settings.
   */
  createProvider(llmSettings?: LlmSettings): ReturnType<typeof createOpenAI> {
    const settings = llmSettings || { provider: "replit" as const };

    let baseURL: string | undefined;
    let apiKey: string | undefined;

    switch (settings.provider) {
      case "replit":
        baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
        apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        break;
      case "openai":
        baseURL = settings.baseUrl || "https://api.openai.com/v1";
        apiKey = settings.apiKey;
        break;
      case "google":
        baseURL =
          settings.baseUrl ||
          "https://generativelanguage.googleapis.com/v1beta/openai";
        apiKey = settings.apiKey;
        break;
      case "groq":
        baseURL = settings.baseUrl || "https://api.groq.com/openai/v1";
        apiKey = settings.apiKey;
        break;
      case "ollama":
        baseURL = settings.baseUrl || "http://localhost:11434/v1";
        apiKey = settings.apiKey || "ollama";
        break;
      case "custom":
        baseURL = settings.baseUrl;
        apiKey = settings.apiKey;
        break;
    }

    return createOpenAI({
      baseURL,
      apiKey: apiKey || "",
    });
  }

  /**
   * Get baseURL used for provider (for verbose logging only, no secrets).
   */
  getBaseUrlForLog(llmSettings?: LlmSettings): string | undefined {
    const settings = llmSettings || { provider: "replit" as const };
    switch (settings.provider) {
      case "replit":
        return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      case "openai":
        return settings.baseUrl || "https://api.openai.com/v1";
      case "google":
        return (
          settings.baseUrl ||
          "https://generativelanguage.googleapis.com/v1beta/openai"
        );
      case "groq":
        return settings.baseUrl || "https://api.groq.com/openai/v1";
      case "ollama":
        return settings.baseUrl || "http://localhost:11434/v1";
      case "custom":
        return settings.baseUrl;
      default:
        return undefined;
    }
  }

  async assertBaseUrlAllowed(llmSettings?: LlmSettings): Promise<void> {
    const provider = llmSettings?.provider ?? "replit";
    const baseURL = this.getBaseUrlForLog(llmSettings);
    if (!baseURL) return;
    await this.outboundUrlPolicy.assertAllowedUrl(baseURL, {
      context: `LLM provider ${provider}`,
      allowHttpInDev: provider === "ollama",
      allowPrivateInDev: provider === "ollama",
    });
  }

  /**
   * Mask baseURL for logging (scheme + host only, no path or secrets).
   */
  maskBaseUrl(url: string | undefined): string {
    if (!url || typeof url !== "string") return "(none)";
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "(invalid)";
    }
  }

  /**
   * Check if verbose logging is enabled.
   */
  isVerboseLogEnabled(): boolean {
    return (
      process.env.NODE_ENV === "development" ||
      process.env.CONDUCTOR_VERBOSE_LOG === "1"
    );
  }

  /**
   * Get pooled credentials for provider (used by ephemeral client pool).
   */
  getPoolCredentialsForProvider(llmSettings?: LlmSettings): {
    llmKey: string;
    llmProvider: string;
    llmBaseUrl?: string;
  } {
    const provider = llmSettings?.provider ?? "replit";
    const baseURL = this.getBaseUrlForLog(llmSettings);
    const fallbackKey =
      provider === "replit"
        ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY || ""
        : "";

    return {
      llmKey: llmSettings?.apiKey || fallbackKey,
      llmProvider: provider,
      llmBaseUrl: baseURL,
    };
  }

  /**
   * Guard for missing API keys on non-replit providers.
   */
  assertApiKeyPresent(llmSettings?: LlmSettings): void {
    const provider = llmSettings?.provider ?? "replit";
    const poolCredentials = this.getPoolCredentialsForProvider(llmSettings);

    if (provider !== "replit" && !poolCredentials.llmKey) {
      AppLogger.warn(
        `API key is required for provider: ${poolCredentials.llmProvider}`,
      );
      throw new Error(`API key is required for provider: ${provider}`);
    }
  }
}
