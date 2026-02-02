import { Injectable } from "@nestjs/common";
import { Response } from "express";
import { streamText, dynamicTool, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
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

export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

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
    private llmService: LlmService,
    private ragService: RagService,
    private erpService: ErpService,
    private ephemeralClientPool: EphemeralClientPoolService,
    private promptInjectionGuard: PromptInjectionGuard,
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
    // Stateless: always return undefined
    // Client should store conversations locally
    return undefined;
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
   * Create tools for Vercel AI SDK with execute handlers
   */
  private createTools(erpSettings?: Partial<ErpConfig>) {
    const erpService = this.erpService;

    const getStockSchema = jsonSchema({
      type: "object",
      properties: {
        product_name: {
          type: "string",
          description: "Название товара или часть названия для поиска",
        },
      },
      required: ["product_name"],
      additionalProperties: false,
    });

    const getProductsSchema = jsonSchema({
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Фильтр по названию товара (опционально)",
        },
      },
      additionalProperties: false,
    });

    const createInvoiceSchema = jsonSchema({
      type: "object",
      properties: {
        customer_name: {
          type: "string",
          description: "Название покупателя/контрагента",
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_name: { type: "string" },
              quantity: { type: "number" },
              price: { type: "number" },
            },
            required: ["product_name", "quantity", "price"],
            additionalProperties: false,
          },
        },
        comment: { type: "string" },
      },
      required: ["items"],
      additionalProperties: false,
    });

    return {
      get_stock: dynamicTool({
        description:
          "Получить остатки товара на складе по названию. Используй когда пользователь спрашивает о наличии, остатках, количестве товара.",
        inputSchema: getStockSchema,
        execute: async (input: unknown) => {
          const { product_name: productName } = input as {
            product_name: string;
          };
          const stock = await erpService.getStock(productName, erpSettings);
          if (stock.length === 0) {
            return `Товары по запросу "${productName}" не найдены.`;
          }
          const stockList = stock
            .map(
              (s) =>
                `• ${s.name} (${s.sku || "без артикула"}): ${s.quantity} ${s.unit || "шт"}`,
            )
            .join("\n");
          return `Остатки по запросу "${productName}":\n${stockList}`;
        },
      }),

      get_products: dynamicTool({
        description: "Получить список товаров из каталога ERP.",
        inputSchema: getProductsSchema,
        execute: async (input: unknown) => {
          const { filter } = input as { filter?: string };
          const products = await erpService.getProducts(filter, erpSettings);
          if (products.length === 0) {
            return filter
              ? `Товары по запросу "${filter}" не найдены.`
              : "Каталог товаров пуст.";
          }
          const productList = products
            .map((p) => {
              const price = p.price ? ` — ${p.price} ₽` : "";
              const type = p.isService ? " (услуга)" : "";
              return `• ${p.name}${price}${type}`;
            })
            .join("\n");
          return `Список товаров${filter ? ` по запросу "${filter}"` : ""}:\n${productList}`;
        },
      }),

      create_invoice: dynamicTool({
        description: "Создать документ реализации (продажи) в ERP.",
        inputSchema: createInvoiceSchema,
        execute: async (input: unknown) => {
          const args = input as {
            customer_name: string;
            items: { product_name: string; quantity: number; price: number }[];
            comment?: string;
          };
          const invoice = await erpService.createInvoice(
            {
              customerName: args.customer_name,
              items: args.items.map((item) => ({
                productName: item.product_name,
                quantity: item.quantity,
                price: item.price,
              })),
              comment: args.comment,
            },
            erpSettings,
          );

          return `Документ создан:\n• Номер: ${invoice.number}\n• Дата: ${new Date(invoice.date).toLocaleDateString("ru-RU")}\n• Покупатель: ${invoice.customerName}\n• Сумма: ${invoice.total} ₽\n• Статус: ${invoice.status === "draft" ? "Черновик" : "Проведён"}`;
        },
      }),
    };
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

  async streamResponse(
    conversationId: number,
    content: string,
    res: Response,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
  ): Promise<void> {
    // Check for prompt injection
    const injectionCheck = this.promptInjectionGuard.detectInjection(content);
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
      const ragResults = await this.ragService.search(content, 2, ragSettings);
      ragContext = this.ragService.buildContext(ragResults);
    } catch (ragError) {
      AppLogger.warn("RAG search failed:", ragError);
    }

    // Build system message with RAG context
    const systemMessage = ragContext
      ? `${SYSTEM_PROMPT}\n\n${ragContext}`
      : SYSTEM_PROMPT;

    // Build messages array for Vercel AI SDK
    const messages = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

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
          const tools = this.createTools(erpSettings);

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
          });

          for await (const part of result.fullStream) {
            const textDelta =
              (part as { text?: string }).text ??
              (part as { delta?: string }).delta;
            if (part.type === "text-delta" && textDelta) {
              res.write(`data: ${JSON.stringify({ content: textDelta })}\n\n`);
            }
            if (verbose) {
              if (part.type === "tool-call") {
                const argsRaw =
                  (part as { args?: unknown }).args ??
                  (part as { input?: unknown }).input;
                const args =
                  argsRaw !== undefined ? JSON.stringify(argsRaw) : "{}";
                AppLogger.info(
                  `[Conductor] tool-call | toolName=${part.toolName} args=${args}`,
                  undefined,
                  "Conductor",
                );
              }
              if (part.type === "tool-result") {
                let out = "[object]";
                const resultOutput =
                  (part as { result?: unknown }).result ??
                  (part as { output?: unknown }).output;
                if (resultOutput !== undefined) {
                  const raw =
                    typeof resultOutput === "string"
                      ? resultOutput
                      : JSON.stringify(resultOutput);
                  out = raw.slice(0, 200) + (raw.length > 200 ? "…" : "");
                }
                AppLogger.info(
                  `[Conductor] tool-result | toolName=${part.toolName} resultSummary=${out}`,
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

  /**
   * Parse raw text (e.g. from Whisper) into structured tool calls and assistant text.
   * Used by POST /api/conductor/parse for Swagger/testing without streaming.
   */
  async parseRawText(
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
        const tools = this.createTools(erpSettings);

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
          args: unknown;
          resultSummary?: string;
        }[] = [];
        let assistantText = "";

        for await (const part of result.fullStream) {
          const textDelta =
            (part as { text?: string }).text ??
            (part as { delta?: string }).delta;
          if (part.type === "text-delta" && textDelta) {
            assistantText += textDelta;
          }
          if (part.type === "tool-call") {
            const args =
              (part as { args?: unknown }).args ??
              (part as { input?: unknown }).input ??
              {};
            toolCallsAcc.push({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args,
            });
          }
          if (part.type === "tool-result") {
            let out = "";
            const resultOutput =
              (part as { result?: unknown }).result ??
              (part as { output?: unknown }).output;
            if (resultOutput !== undefined) {
              const raw =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);
              out = raw.slice(0, 300) + (raw.length > 300 ? "…" : "");
            }
            const entry = toolCallsAcc.find(
              (e) => e.toolCallId === part.toolCallId,
            );
            if (entry) entry.resultSummary = out;
          }
        }

        return {
          rawText,
          toolCalls: toolCallsAcc.map((e) => ({
            toolName: e.toolName,
            args: e.args,
            resultSummary: e.resultSummary ?? "",
            confidence: this.calculateConfidence(e),
            diffPreview: this.generateDiffPreview(e, erpSettings),
          })),
          assistantText,
        };
      },
      false, // isStreaming = false (though it uses streamText internally, it's a single request)
    );
  }

  /**
   * Calculate confidence score for a tool call (0-1).
   * Simple heuristic: higher confidence for successful results.
   */
  private calculateConfidence(toolCall: {
    toolName: string;
    args: unknown;
    resultSummary?: string;
  }): number {
    // Base confidence
    let confidence = 0.8;

    // Increase confidence if result summary indicates success
    if (toolCall.resultSummary) {
      const lowerSummary = toolCall.resultSummary.toLowerCase();
      if (
        lowerSummary.includes("создан") ||
        lowerSummary.includes("найдено") ||
        lowerSummary.includes("успешно")
      ) {
        confidence = 0.9;
      } else if (
        lowerSummary.includes("не найдено") ||
        lowerSummary.includes("ошибка")
      ) {
        confidence = 0.6;
      }
    }

    // Decrease confidence for create_invoice (more critical)
    if (toolCall.toolName === "create_invoice") {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
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
