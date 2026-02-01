import { Injectable } from "@nestjs/common";
import { Response } from "express";
import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { ErpService } from "../erp/erp.service";
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
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message[]> = new Map();
  private nextConversationId = 1;
  private nextMessageId = 1;

  constructor(
    private llmService: LlmService,
    private ragService: RagService,
    private erpService: ErpService,
  ) {}

  createConversation(title: string): Conversation {
    const conversation: Conversation = {
      id: this.nextConversationId++,
      title,
      createdAt: new Date().toISOString(),
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return conversation;
  }

  getConversation(id: number): Conversation | undefined {
    return this.conversations.get(id);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  deleteConversation(id: number): boolean {
    this.messages.delete(id);
    return this.conversations.delete(id);
  }

  getMessages(conversationId: number): Message[] {
    return this.messages.get(conversationId) || [];
  }

  addMessage(
    conversationId: number,
    role: "user" | "assistant",
    content: string,
  ): Message {
    const message: Message = {
      id: this.nextMessageId++,
      conversationId,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    const msgs = this.messages.get(conversationId) || [];
    msgs.push(message);
    this.messages.set(conversationId, msgs);
    return message;
  }

  /**
   * Create Vercel AI SDK provider based on LLM settings
   */
  private createAiProvider(llmSettings?: LlmSettings) {
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

    return {
      get_stock: tool({
        description:
          "Получить остатки товара на складе по названию. Используй когда пользователь спрашивает о наличии, остатках, количестве товара.",
        inputSchema: z.object({
          product_name: z
            .string()
            .describe("Название товара или часть названия для поиска"),
        }),
        execute: async ({ product_name }: { product_name: string }) => {
          const stock = await erpService.getStock(product_name, erpSettings);
          if (stock.length === 0) {
            return `Товары по запросу "${product_name}" не найдены.`;
          }
          const stockList = stock
            .map(
              (s) =>
                `• ${s.name} (${s.sku || "без артикула"}): ${s.quantity} ${s.unit || "шт"}`,
            )
            .join("\n");
          return `Остатки по запросу "${product_name}":\n${stockList}`;
        },
      }),

      get_products: tool({
        description: "Получить список товаров из каталога ERP.",
        inputSchema: z.object({
          filter: z
            .string()
            .optional()
            .describe("Фильтр по названию товара (опционально)"),
        }),
        execute: async ({ filter }: { filter?: string }) => {
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

      create_invoice: tool({
        description: "Создать документ реализации (продажи) в ERP.",
        inputSchema: z.object({
          customer_name: z
            .string()
            .optional()
            .describe("Название покупателя/контрагента"),
          items: z.array(
            z.object({
              product_name: z.string(),
              quantity: z.number(),
              price: z.number(),
            }),
          ),
          comment: z.string().optional(),
        }),
        execute: async ({
          customer_name,
          items,
          comment,
        }: {
          customer_name?: string;
          items: {
            product_name: string;
            quantity: number;
            price: number;
          }[];
          comment?: string;
        }) => {
          const invoice = await erpService.createInvoice(
            {
              customerName: customer_name,
              items: items.map(
                (item: {
                  product_name: string;
                  quantity: number;
                  price: number;
                }) => ({
                  productName: item.product_name,
                  quantity: item.quantity,
                  price: item.price,
                }),
              ),
              comment,
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
    // Save user message
    this.addMessage(conversationId, "user", content);

    // Get conversation history
    const history = this.getMessages(conversationId);

    // Search RAG for context
    let ragContext = "";
    try {
      const ragConfig =
        ragSettings?.provider === "qdrant" && ragSettings.qdrant?.url
          ? {
              url: ragSettings.qdrant.url,
              apiKey: ragSettings.qdrant.apiKey,
              collectionName: ragSettings.qdrant.collectionName || "kb_jarvis",
            }
          : undefined;
      const ragResults = await this.ragService.search(content, 2, ragConfig);
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
    ];

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      // Create AI provider and tools
      const aiProvider = this.createAiProvider(llmSettings);
      const modelName = this.llmService.getModel(llmSettings);
      const tools = this.createTools(erpSettings);

      const provider = llmSettings?.provider ?? "replit";
      const baseURL = this.getBaseUrlForLog(llmSettings);
      const verbose = this.isVerboseLogEnabled();
      if (verbose) {
        AppLogger.info(
          `[Conductor] LLM request started | provider=${provider} baseURL=${this.maskBaseUrl(baseURL)} model=${modelName}`,
          undefined,
          "Conductor",
        );
      }

      // Stream with Vercel AI SDK (fullStream to get tool-call / tool-result for logging)
      const result = streamText({
        model: aiProvider(modelName),
        system: systemMessage,
        messages,
        tools,
        maxOutputTokens: 2048,
      });

      let fullResponse = "";

      for await (const part of result.fullStream) {
        const textDelta =
          (part as { text?: string }).text ??
          (part as { delta?: string }).delta;
        if (part.type === "text-delta" && textDelta) {
          fullResponse += textDelta;
          res.write(`data: ${JSON.stringify({ content: textDelta })}\n\n`);
        }
        if (verbose) {
          if (part.type === "tool-call") {
            const argsRaw =
              (part as { args?: unknown }).args ??
              (part as { input?: unknown }).input;
            const args = argsRaw !== undefined ? JSON.stringify(argsRaw) : "{}";
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

      // Save assistant message
      this.addMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
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
  }> {
    let ragContext = "";
    try {
      const ragConfig =
        ragSettings?.provider === "qdrant" && ragSettings.qdrant?.url
          ? {
              url: ragSettings.qdrant.url,
              apiKey: ragSettings.qdrant.apiKey,
              collectionName: ragSettings.qdrant.collectionName || "kb_jarvis",
            }
          : undefined;
      const ragResults = await this.ragService.search(rawText, 2, ragConfig);
      ragContext = this.ragService.buildContext(ragResults);
    } catch {
      // ignore RAG errors
    }
    const systemMessage = ragContext
      ? `${SYSTEM_PROMPT}\n\n${ragContext}`
      : SYSTEM_PROMPT;
    const aiProvider = this.createAiProvider(llmSettings);
    const modelName = this.llmService.getModel(llmSettings);
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
        (part as { text?: string }).text ?? (part as { delta?: string }).delta;
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
      })),
      assistantText,
    };
  }
}
