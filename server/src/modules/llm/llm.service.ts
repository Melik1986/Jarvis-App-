import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { LlmProvider, LlmSettings, ProviderConfig } from "./llm.types";
import { OutboundUrlPolicy } from "../../security/outbound-url-policy";

@Injectable()
export class LlmService implements OnModuleInit {
  private providerConfigs!: Record<LlmProvider, ProviderConfig>;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(OutboundUrlPolicy)
    private readonly outboundUrlPolicy: OutboundUrlPolicy,
  ) {}

  onModuleInit() {
    this.providerConfigs = {
      replit: {
        baseUrl:
          this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL") ||
          "https://api.openai.com/v1",
        apiKey: this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY") || "",
        defaultModel: "gpt-5.2",
        available: true,
      },
      openai: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        defaultModel: "gpt-5.2",
        available: true,
      },
      google: {
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: "",
        defaultModel: "gemini-2.5-flash",
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
        apiKey: "ollama",
        defaultModel: "llama3",
        available: true,
      },
      custom: {
        baseUrl: "",
        apiKey: "",
        defaultModel: "gpt-5.2",
        available: true,
      },
    };
  }

  /** Allowed hosts per provider (for validation before request). */
  private static readonly PROVIDER_HOSTS: Record<
    Exclude<LlmProvider, "replit" | "custom">,
    string[]
  > = {
    openai: ["api.openai.com"],
    google: ["generativelanguage.googleapis.com"],
    groq: ["api.groq.com"],
    ollama: ["localhost", "127.0.0.1"],
  };

  private validateProviderBaseUrl(settings: LlmSettings): void {
    if (!settings.baseUrl) return;
    const provider = settings.provider;
    this.outboundUrlPolicy.assertAllowedUrlSync(settings.baseUrl, {
      context: `LLM provider ${provider}`,
      allowHttpInDev: provider === "ollama",
      allowPrivateInDev: provider === "ollama",
    });
    if (provider === "replit" || provider === "custom") return;
    const allowed = LlmService.PROVIDER_HOSTS[provider];
    if (!allowed) return;
    try {
      const host = new URL(settings.baseUrl).hostname.toLowerCase();
      if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
        throw new Error(
          `Provider ${provider} requires baseURL host ${allowed.join(" or ")}; got ${host}`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Provider "))
        throw err;
      throw new Error(`Invalid baseURL for provider ${provider}`);
    }
  }

  private getProviderConfig(settings: LlmSettings): ProviderConfig {
    const baseConfig = this.providerConfigs[settings.provider];

    if (!baseConfig) {
      throw new Error(`Unknown LLM provider: ${settings.provider}`);
    }

    if (!baseConfig.available) {
      throw new Error(`Provider ${settings.provider} is not available`);
    }

    this.validateProviderBaseUrl(settings);

    return {
      baseUrl: settings.baseUrl || baseConfig.baseUrl,
      apiKey: settings.apiKey || baseConfig.apiKey,
      defaultModel: settings.modelName || baseConfig.defaultModel,
      available: baseConfig.available,
    };
  }

  createClient(settings?: LlmSettings): OpenAI {
    if (!settings || settings.provider === "replit") {
      const apiKey =
        this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY") || "";
      const baseURL =
        this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL") ||
        "https://api.openai.com/v1";
      if (!apiKey) {
        throw new Error("API key is required for provider: replit");
      }
      return new OpenAI({
        apiKey,
        baseURL,
      });
    }

    const config = this.getProviderConfig(settings);

    if (!config.apiKey && settings.provider !== "ollama") {
      throw new Error(`API key is required for provider: ${settings.provider}`);
    }

    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  getModel(settings?: LlmSettings): string {
    if (!settings) {
      return "gpt-5.2";
    }
    const config = this.getProviderConfig(settings);
    return settings.modelName || config.defaultModel;
  }

  isProviderAvailable(provider: LlmProvider): boolean {
    return this.providerConfigs[provider]?.available ?? false;
  }

  getAvailableModels(provider: LlmProvider): string[] {
    switch (provider) {
      case "replit":
        return [
          "gpt-5.2",
          "gpt-5.1",
          "claude-sonnet-4",
          "claude-opus-4.1",
          "gemini-3.1-pro-preview",
        ];
      case "openai":
        return ["gpt-5.2", "gpt-5.1", "gpt-5-mini", "gpt-5-nano", "o3"];
      case "google":
        return [
          "gemini-3.1-pro-preview",
          "gemini-3-flash-preview",
          "gemini-3-pro-preview",
          "gemini-2.5-pro",
          "gemini-2.5-flash",
        ];
      case "groq":
        return [
          "meta-llama/llama-4-maverick-17b-128e-instruct",
          "meta-llama/llama-4-scout-17b-16e-instruct",
          "moonshotai/kimi-k2-instruct-0905",
          "qwen/qwen3-32b",
          "openai/gpt-oss-120b",
        ];
      case "ollama":
        return ["qwen3", "qwen3-coder", "deepseek-r1", "gemma3", "llama3.3"];
      case "custom":
        return [];
      default:
        return [];
    }
  }
}
