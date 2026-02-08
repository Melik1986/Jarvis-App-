import { Injectable, Inject } from "@nestjs/common";
import { Response } from "express";
import {
  streamText,
  type Tool,
  type ModelMessage,
  type TextPart,
  type ImagePart,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { toFile } from "openai/uploads";
import pdfParse from "pdf-parse";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { ErpService } from "../erp/erp.service";
import { EphemeralClientPoolService } from "../../services/ephemeral-client-pool.service";
import { PromptInjectionGuard } from "../../guards/prompt-injection.guard";
import { LlmSettings } from "../llm/llm.types";
import { ErpConfig } from "../erp/erp.types";
import { RagSettingsRequest } from "../rag/rag.types";
import { AppLogger } from "../../utils/logger";
import {
  isLlmProviderError,
  getLlmProviderErrorBody,
} from "../../filters/llm-provider-exception.filter";

import { ToolRegistryService } from "./tool-registry.service";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { CoveWorkflowService } from "./cove-workflow.service";
import { GuardianGuard } from "../../guards/guardian.guard";

export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Attachment {
  name: string;
  type: "image" | "file";
  mimeType: string;
  uri: string;
  base64?: string;
}

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

type StreamPart = {
  type: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  input?: Record<string, unknown>;
  result?: unknown;
  output?: unknown;
  text?: string;
  delta?: string;
};

type UserContentPart = TextPart | ImagePart;
type PdfParse = (data: Buffer) => Promise<{ text: string }>;
const parsePdf = pdfParse as unknown as PdfParse;

const SYSTEM_PROMPT = `Ты — Axon Business AI-ассистент, AI-ассистент для управления бизнес-процессами в ERP.
Ты можешь:
- Проверять остатки товаров на складе (get_stock)
- Получать список товаров (get_products)
- Создавать документы реализации (create_invoice)
- Отвечать на вопросы по регламентам и инструкциям компании

Отвечай кратко и по делу. Используй функции когда это уместно.
При работе с данными ERP всегда показывай результаты в удобном формате.`;

// Tools will be created dynamically in the service with execute handlers

@Injectable()
export class ChatService {
  // Stateless: no in-memory storage
  // Conversations and messages are stored on client (AsyncStorage)
  // Server only processes requests without state

  constructor(
    @Inject(LlmService) private llmService: LlmService,
    @Inject(RagService) private ragService: RagService,
    @Inject(ErpService) private erpService: ErpService,
    @Inject(EphemeralClientPoolService)
    private ephemeralClientPool: EphemeralClientPoolService,
    @Inject(PromptInjectionGuard)
    private promptInjectionGuard: PromptInjectionGuard,
    @Inject(ToolRegistryService) private toolRegistry: ToolRegistryService,
    @Inject(ConfidenceScorerService)
    private confidenceScorer: ConfidenceScorerService,
    @Inject(CoveWorkflowService) private coveWorkflow: CoveWorkflowService,
    @Inject(GuardianGuard) private guardian: GuardianGuard,
  ) {}

  // Stateless stubs: client stores conversations/messages locally
  createConversation(title: string): Conversation {
    // Return stub - client generates ID and stores locally
    return {
      id: Date.now(), // Temporary ID, client should use UUID
      title,
      createdAt: new Date().toISOString(),
    };
  }

  getConversation(id: number): Conversation | undefined {
    return {
      id,
      title: "Chat",
      createdAt: new Date().toISOString(),
    };
  }

  getAllConversations(): Conversation[] {
    // Stateless: return empty array
    // Client should store conversations locally
    return [];
  }

  deleteConversation(id: number): boolean {
    // Stateless: always return true
    // Client should handle deletion locally
    return true;
  }

  getMessages(conversationId: number): Message[] {
    // Stateless: return empty array
    // Client should store messages locally
    return [];
  }

  addMessage(
    conversationId: number,
    role: "user" | "assistant",
    content: string,
  ): Message {
    // Stateless stub: client should store messages locally
    return {
      id: Date.now(),
      conversationId,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create Vercel AI SDK provider based on LLM settings using ephemeral client pool
   */
  private async createAiProviderWithPool(
    llmSettings?: LlmSettings,
    isStreaming = false,
  ): Promise<ReturnType<typeof createOpenAI>> {
    const settings = llmSettings || { provider: "replit" as const };

    // Get base URL and API key based on provider
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

    if (!apiKey) {
      throw new Error(`API key is required for provider: ${settings.provider}`);
    }

    // Create provider using client from pool
    // Note: We still use createOpenAI but credentials are managed through pool
    // The actual OpenAI client is cached in pool for reuse
    return createOpenAI({
      baseURL,
      apiKey,
    });
  }

  /**
   * Legacy method for backward compatibility (uses pool internally)
   */
  private createAiProvider(llmSettings?: LlmSettings) {
    // For non-streaming, we can create provider directly
    // Pool will be used when actually making requests
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
  private getBaseUrlForLog(llmSettings?: LlmSettings): string | undefined {
    const settings = llmSettings || { provider: "replit" as const };
    switch (settings.provider) {
      case "replit":
        return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      case "openai":
        return settings.baseUrl || "https://api.openai.com/v1";
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

  /**
   * Mask baseURL for logging (scheme + host only, no path or secrets).
   */
  private maskBaseUrl(url: string | undefined): string {
    if (!url || typeof url !== "string") return "(none)";
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "(invalid)";
    }
  }

  private isVerboseLogEnabled(): boolean {
    return (
      process.env.NODE_ENV === "development" ||
      process.env.CONDUCTOR_VERBOSE_LOG === "1"
    );
  }

  private getTranscriptionModel(model?: string): string {
    return model || "gpt-4o-mini-transcribe";
  }

  private getPoolCredentialsForProvider(llmSettings?: LlmSettings): {
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

  private async transcribeAudio(
    audioBase64: string,
    llmSettings?: LlmSettings,
    transcriptionModel?: string,
  ): Promise<string> {
    const poolCredentials = this.getPoolCredentialsForProvider(llmSettings);
    if (poolCredentials.llmProvider !== "replit" && !poolCredentials.llmKey) {
      throw new Error(
        `API key is required for provider: ${poolCredentials.llmProvider}`,
      );
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const file = await toFile(audioBuffer, "voice-input.wav");
    const model = this.getTranscriptionModel(transcriptionModel);

    return await this.ephemeralClientPool.useClient(
      poolCredentials,
      async (client) => {
        const response = await client.audio.transcriptions.create({
          file,
          model,
        });
        return response.text || "";
      },
      false,
    );
  }

  async streamResponse(
    userId: string,
    conversationId: number,
    rawText: string,
    res: Response,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
    attachments?: Attachment[],
  ) {
    // Check for prompt injection
    const injectionCheck = this.promptInjectionGuard.detectInjection(rawText);
    if (injectionCheck.requireManualReview) {
      res.status(400).json({
        error: "Prompt injection detected",
        warning: injectionCheck.warning,
        requiresConfirmation: true,
      });
      return;
    }

    // Stateless: no message storage
    // Client should send history in request if needed
    // For now, we process without history (each request is independent)
    const history: { role: "user" | "assistant"; content: string }[] = [];

    // Search RAG for context
    let ragContext = "";
    try {
      const ragResults = await this.ragService.search(rawText, 2, ragSettings);
      ragContext = this.ragService.buildContext(ragResults);
    } catch (ragError) {
      AppLogger.warn("RAG search failed:", ragError);
    }

    // Build system message with RAG context
    const systemMessage = ragContext
      ? `${SYSTEM_PROMPT}\n\n${ragContext}`
      : SYSTEM_PROMPT;

    // Build messages array for Vercel AI SDK (cap history + strip old images)
    const MAX_HISTORY_MESSAGES = 20;
    const messages: ModelMessage[] = history
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => {
        // Strip non-text parts (images/files) from multimodal history to save tokens
        const content =
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? (m.content as Array<{ type: string; text?: string }>)
                  .filter((p) => p.type === "text")
                  .map((p) => p.text ?? "")
                  .join("\n")
              : String(m.content);
        return { role: m.role as "user" | "assistant", content };
      }) as ModelMessage[];

    // Handle multimodal content
    if (attachments && attachments.length > 0) {
      const contentParts: UserContentPart[] = [{ type: "text", text: rawText }];

      for (const att of attachments) {
        if (att.type === "image" && att.base64) {
          contentParts.push({
            type: "image",
            image: att.base64,
            providerOptions: { openai: { imageDetail: "low" } },
          });
        } else if (att.type === "file") {
          // Process documents
          if (att.mimeType === "application/pdf" && att.base64) {
            try {
              const buffer = Buffer.from(att.base64, "base64");
              // Use a simple mock or real pdf-parse if available.
              // Since we imported * as pdf, we assume it works.
              // Note: pdf-parse might need to be awaited if it's async
              const data = await parsePdf(buffer);
              contentParts.push({
                type: "text",
                text: `\n[Document Content: ${att.name}]\n${data.text}\n[End Document Content]\n`,
              });
            } catch (e) {
              AppLogger.error(`Failed to parse PDF ${att.name}`, e);
              contentParts.push({
                type: "text",
                text: `\n[System: Failed to parse PDF ${att.name}]\n`,
              });
            }
          } else if (att.base64) {
            // Assume text-based file
            try {
              const text = Buffer.from(att.base64, "base64").toString("utf-8");
              contentParts.push({
                type: "text",
                text: `\n[File Content: ${att.name}]\n${text}\n[End File Content]\n`,
              });
            } catch (e) {
              AppLogger.error(`Failed to decode text file ${att.name}`, e);
            }
          }
        }
      }
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({ role: "user", content: rawText });
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const provider = llmSettings?.provider ?? "replit";
      const baseURL = this.getBaseUrlForLog(llmSettings);
      const modelName = this.llmService.getModel(llmSettings);
      const verbose = this.isVerboseLogEnabled();

      // Extract credentials for pool
      const poolCredentials = {
        llmKey: llmSettings?.apiKey || "",
        llmProvider: provider,
        llmBaseUrl: baseURL,
      };

      // Ensure API key is present for non-replit providers
      if (provider !== "replit" && !poolCredentials.llmKey) {
        throw new Error(`API key is required for provider: ${provider}`);
      }

      // Use ephemeral client pool for the duration of the stream
      await this.ephemeralClientPool.useClient(
        poolCredentials,
        async () => {
          // Create AI provider and tools
          const aiProvider = this.createAiProvider(llmSettings);
          const tools: Record<
            string,
            Tool<unknown, unknown>
          > = await this.toolRegistry.getTools(userId, erpSettings);

          if (verbose) {
            AppLogger.info(
              `[Conductor] LLM request started | provider=${provider} baseURL=${this.maskBaseUrl(baseURL)} model=${modelName}`,
              undefined,
              "Conductor",
            );
          }

          // Stream with Vercel AI SDK
          const result = streamText({
            model: aiProvider(modelName),
            system: systemMessage,
            messages,
            tools,
            maxOutputTokens: 2048,
            providerOptions: {
              openai: { truncation: "auto" },
            },
          });

          const toolCallsArgs = new Map<string, Record<string, unknown>>();

          for await (const part of result.fullStream) {
            const partData = part as StreamPart;
            const textDelta = partData.text ?? partData.delta;
            if (partData.type === "text-delta" && textDelta) {
              res.write(`data: ${JSON.stringify({ content: textDelta })}\n\n`);
            }

            if (partData.type === "tool-call") {
              const args = (partData.args ?? partData.input ?? {}) as Record<
                string,
                unknown
              >;
              const toolName = partData.toolName ?? "unknown";
              const toolCallId =
                (partData as { toolCallId?: string }).toolCallId || "default";
              toolCallsArgs.set(toolCallId, args);

              res.write(
                `data: ${JSON.stringify({
                  toolCall: { toolName, args },
                })}\n\n`,
              );

              if (verbose) {
                AppLogger.info(
                  `[Conductor] tool-call | toolName=${toolName} args=${JSON.stringify(args)}`,
                  undefined,
                  "Conductor",
                );
              }
            }

            if (partData.type === "tool-result") {
              const toolCallId =
                (partData as { toolCallId?: string }).toolCallId || "default";
              const args = toolCallsArgs.get(toolCallId) || {};
              const toolName = partData.toolName ?? "unknown";

              const guardianResult = await this.guardian.check(
                userId,
                toolName,
                args,
              );

              const resultOutput = partData.result ?? partData.output;
              const resultSummary =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);

              // Calculate confidence for this tool result
              const confidence = this.confidenceScorer.calculateConfidence({
                toolName,
                args,
                resultSummary,
                guardianAction: guardianResult.action,
              });

              res.write(
                `data: ${JSON.stringify({
                  toolResult: {
                    toolName,
                    resultSummary,
                    confidence,
                    action: guardianResult.action,
                  },
                })}\n\n`,
              );

              if (verbose) {
                AppLogger.info(
                  `[Conductor] tool-result | toolName=${toolName} resultSummary=${resultSummary.slice(0, 100)}`,
                  undefined,
                  "Conductor",
                );
              }
            }
          }

          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        },
        true, // isStreaming = true
      );

      res.end();
    } catch (error) {
      AppLogger.error("Error in chat stream:", error);
      if (!res.headersSent) {
        if (isLlmProviderError(error)) {
          const body = getLlmProviderErrorBody(error);
          res.status(body.statusCode).json(body);
        } else {
          res.status(500).json({ error: "Failed to process message" });
        }
      } else {
        const msg = isLlmProviderError(error)
          ? getLlmProviderErrorBody(error).message
          : "Failed to process message";
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      }
    }
  }

  async streamVoiceResponse(
    userId: string,
    conversationId: number,
    audioBase64: string,
    res: Response,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
    transcriptionModel?: string,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const conversation = this.getConversation(conversationId);
      if (!conversation) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: "Conversation not found",
          })}\n\n`,
        );
        res.end();
        return;
      }

      const userTranscript = await this.transcribeAudio(
        audioBase64,
        llmSettings,
        transcriptionModel,
      );

      res.write(
        `data: ${JSON.stringify({
          type: "user_transcript",
          data: userTranscript,
        })}\n\n`,
      );

      if (!userTranscript.trim()) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: "Empty transcription",
          })}\n\n`,
        );
        res.end();
        return;
      }

      const injectionCheck =
        this.promptInjectionGuard.detectInjection(userTranscript);
      if (injectionCheck.requireManualReview) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: "Prompt injection detected",
          })}\n\n`,
        );
        res.end();
        return;
      }

      let ragContext = "";
      try {
        const ragResults = await this.ragService.search(
          userTranscript,
          2,
          ragSettings,
        );
        ragContext = this.ragService.buildContext(ragResults);
      } catch (ragError) {
        AppLogger.warn("RAG search failed:", ragError);
      }

      const systemMessage = ragContext
        ? `${SYSTEM_PROMPT}\n\n${ragContext}`
        : SYSTEM_PROMPT;

      const messages: ModelMessage[] = [
        { role: "user", content: userTranscript },
      ];

      const provider = llmSettings?.provider ?? "replit";
      const baseURL = this.getBaseUrlForLog(llmSettings);
      const modelName = this.llmService.getModel(llmSettings);
      const verbose = this.isVerboseLogEnabled();

      const poolCredentials = this.getPoolCredentialsForProvider(llmSettings);
      if (provider !== "replit" && !poolCredentials.llmKey) {
        throw new Error(`API key is required for provider: ${provider}`);
      }

      await this.ephemeralClientPool.useClient(
        poolCredentials,
        async () => {
          const aiProvider = this.createAiProvider(llmSettings);
          const tools: Record<
            string,
            Tool<unknown, unknown>
          > = await this.toolRegistry.getTools(userId, erpSettings);

          if (verbose) {
            AppLogger.info(
              `[Voice] LLM request started | provider=${provider} baseURL=${this.maskBaseUrl(baseURL)} model=${modelName}`,
              undefined,
              "Voice",
            );
          }

          const result = streamText({
            model: aiProvider(modelName),
            system: systemMessage,
            messages,
            tools,
            maxOutputTokens: 2048,
          });

          const toolCallsArgs = new Map<string, Record<string, unknown>>();

          for await (const part of result.fullStream) {
            const partData = part as StreamPart;
            const textDelta = partData.text ?? partData.delta;
            if (partData.type === "text-delta" && textDelta) {
              res.write(
                `data: ${JSON.stringify({
                  type: "transcript",
                  data: textDelta,
                })}\n\n`,
              );
            }

            if (partData.type === "tool-call") {
              const args = (partData.args ?? partData.input ?? {}) as Record<
                string,
                unknown
              >;
              const toolCallId =
                (partData as { toolCallId?: string }).toolCallId || "default";
              toolCallsArgs.set(toolCallId, args);
            }

            if (partData.type === "tool-result") {
              const toolCallId =
                (partData as { toolCallId?: string }).toolCallId || "default";
              const args = toolCallsArgs.get(toolCallId) || {};
              const toolName = partData.toolName ?? "unknown";
              const resultOutput = partData.result ?? partData.output;
              const resultSummary =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);

              await this.guardian.check(userId, toolName, args);

              if (verbose) {
                AppLogger.info(
                  `[Voice] tool-result | toolName=${toolName} resultSummary=${resultSummary.slice(0, 100)}`,
                  undefined,
                  "Voice",
                );
              }
            }
          }

          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        },
        true,
      );

      res.end();
    } catch (error) {
      AppLogger.error("Error in voice stream:", error);
      if (!res.headersSent) {
        if (isLlmProviderError(error)) {
          const body = getLlmProviderErrorBody(error);
          res.status(body.statusCode).json(body);
        } else {
          res.status(500).json({ error: "Failed to process voice message" });
        }
      } else {
        const msg = isLlmProviderError(error)
          ? getLlmProviderErrorBody(error).message
          : "Failed to process voice message";
        res.write(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
        res.end();
      }
    }
  }

  /**
   * Parse raw text (e.g. from Whisper) into structured tool calls and assistant text.
   * Used by POST /api/conductor/parse for Swagger/testing without streaming.
   */
  async parseRawText(
    userId: string,
    rawText: string,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
  ): Promise<{
    rawText: string;
    toolCalls: { toolName: string; args: unknown; resultSummary: string }[];
    assistantText: string;
    warning?: string;
    requiresConfirmation?: boolean;
  }> {
    // Check for prompt injection
    const injectionCheck = this.promptInjectionGuard.detectInjection(rawText);
    if (injectionCheck.requireManualReview) {
      return {
        rawText,
        toolCalls: [],
        assistantText: "",
        warning: injectionCheck.warning,
        requiresConfirmation: true,
      };
    }

    let ragContext = "";
    try {
      const ragResults = await this.ragService.search(rawText, 2, ragSettings);
      ragContext = this.ragService.buildContext(ragResults);
    } catch {
      // ignore RAG errors
    }
    const systemMessage = ragContext
      ? `${SYSTEM_PROMPT}\n\n${ragContext}`
      : SYSTEM_PROMPT;

    const provider = llmSettings?.provider ?? "replit";
    const baseURL = this.getBaseUrlForLog(llmSettings);
    const modelName = this.llmService.getModel(llmSettings);

    // Extract credentials for pool
    const poolCredentials = {
      llmKey: llmSettings?.apiKey || "",
      llmProvider: provider,
      llmBaseUrl: baseURL,
    };

    // Use ephemeral client pool for parsing
    return await this.ephemeralClientPool.useClient(
      poolCredentials,
      async () => {
        const aiProvider = this.createAiProvider(llmSettings);
        const tools: Record<
          string,
          Tool<unknown, unknown>
        > = await this.toolRegistry.getTools(userId, erpSettings);

        const result = streamText({
          model: aiProvider(modelName),
          system: systemMessage,
          messages: [{ role: "user", content: rawText }],
          tools,
          maxOutputTokens: 2048,
        });

        const toolCallsAcc: {
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
          resultSummary?: string;
        }[] = [];
        let assistantText = "";

        for await (const part of result.fullStream) {
          const partData = part as StreamPart;
          const textDelta = partData.text ?? partData.delta;
          if (partData.type === "text-delta" && textDelta) {
            assistantText += textDelta;
          }
          if (partData.type === "tool-call") {
            const args = (partData.args ?? partData.input ?? {}) as Record<
              string,
              unknown
            >;
            toolCallsAcc.push({
              toolCallId: partData.toolCallId ?? "",
              toolName: partData.toolName ?? "unknown",
              args,
            });
          }
          if (partData.type === "tool-result") {
            let out = "";
            const resultOutput = partData.result ?? partData.output;
            if (resultOutput !== undefined) {
              const raw =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);
              out = raw.slice(0, 300) + (raw.length > 300 ? "…" : "");
            }
            const entry = toolCallsAcc.find(
              (e) => e.toolCallId === partData.toolCallId,
            );
            if (entry) entry.resultSummary = out;
          }
        }

        // Apply CoVe workflow: inject read tools before write tools
        const finalToolCalls: {
          toolName: string;
          args: Record<string, unknown>;
          resultSummary: string;
          confidence?: number;
          isVerification?: boolean;
          diffPreview?:
            | {
                before: Record<string, unknown>;
                after: Record<string, unknown>;
              }
            | undefined;
        }[] = [];
        for (const e of toolCallsAcc) {
          if (this.coveWorkflow.needsVerification(e.toolName)) {
            const verifications = this.coveWorkflow.getVerificationTools(
              e.toolName,
              e.args,
            );
            for (const v of verifications) {
              // Execute verification tool to get summary
              const vTools: Record<
                string,
                Tool<unknown, unknown>
              > = await this.toolRegistry.getTools(userId, erpSettings);
              const vTool = vTools[v.toolName];
              let vResult = "";
              if (vTool && "execute" in vTool && vTool.execute) {
                const out = await vTool.execute(
                  v.args as Record<string, unknown>,
                  {
                    toolCallId: "cove-verification",
                    messages: [],
                  },
                );
                vResult = typeof out === "string" ? out : JSON.stringify(out);
              }
              finalToolCalls.push({
                toolName: v.toolName,
                args: v.args,
                resultSummary: vResult,
                isVerification: true,
                confidence: 1.0,
              });
            }
          }
          finalToolCalls.push({
            toolName: e.toolName,
            args: e.args,
            resultSummary: e.resultSummary ?? "",
            confidence: this.confidenceScorer.calculateConfidence(e),
            diffPreview: this.generateDiffPreview(e, erpSettings),
          });
        }

        return {
          rawText,
          toolCalls: finalToolCalls,
          assistantText,
        };
      },
      false, // isStreaming = false (though it uses streamText internally, it's a single request)
    );
  }

  /**
   * Generate diff preview for a tool call.
   */
  private generateDiffPreview(
    toolCall: {
      toolName: string;
      args: unknown;
      resultSummary?: string;
    },
    erpSettings?: Partial<ErpConfig>,
  ):
    | { before: Record<string, unknown>; after: Record<string, unknown> }
    | undefined {
    if (toolCall.toolName === "create_invoice") {
      const args = toolCall.args as {
        items?: { product_name: string; quantity: number; price: number }[];
        customer_name?: string;
      };

      if (args.items && args.items.length > 0) {
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};

        // Show what will be created
        args.items.forEach((item, index) => {
          before[`item_${index}`] = "Not created";
          after[`item_${index}`] =
            `${item.product_name}: ${item.quantity} × ${item.price} ₽`;
        });

        if (args.customer_name) {
          before.customer = "Not set";
          after.customer = args.customer_name;
        }

        return { before, after };
      }
    } else if (toolCall.toolName === "get_stock") {
      // For get_stock, show query vs results
      const args = toolCall.args as { product_name?: string };
      return {
        before: { query: args.product_name || "N/A" },
        after: { result: toolCall.resultSummary || "No results" },
      };
    }

    return undefined;
  }
}
