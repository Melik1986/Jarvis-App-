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

interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

const SYSTEM_PROMPT = `Ты — Jarvis, AI-ассистент для управления бизнес-процессами в 1С.
Ты можешь:
- Проверять остатки товаров на складе (get_stock)
- Получать список товаров (get_products)
- Создавать документы реализации (create_invoice)
- Отвечать на вопросы по регламентам и инструкциям компании

Отвечай кратко и по делу. Используй функции когда это уместно.
При работе с данными 1С всегда показывай результаты в удобном формате.`;

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
   * Create tools for Vercel AI SDK with execute handlers
   */
  private createTools(erpSettings?: ErpConfig) {
    const erpService = this.erpService;

    return {
      get_stock: tool({
        description:
          "Получить остатки товара на складе по названию. Используй когда пользователь спрашивает о наличии, остатках, количестве товара.",
        parameters: z.object({
          product_name: z
            .string()
            .describe("Название товара или часть названия для поиска"),
        }),
        execute: async ({ product_name }) => {
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
        description: "Получить список товаров из каталога 1С.",
        parameters: z.object({
          filter: z
            .string()
            .optional()
            .describe("Фильтр по названию товара (опционально)"),
        }),
        execute: async ({ filter }) => {
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
        description: "Создать документ реализации (продажи) в 1С.",
        parameters: z.object({
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
        execute: async ({ customer_name, items, comment }) => {
          const invoice = await erpService.createInvoice(
            {
              customerName: customer_name,
              items: items.map((item) => ({
                productName: item.product_name,
                quantity: item.quantity,
                price: item.price,
              })),
              comment,
            },
            erpSettings,
          );

          return `Документ создан:\n• Номер: ${invoice.number}\n• Дата: ${new Date(invoice.date).toLocaleDateString("ru-RU")}\n• Покупатель: ${invoice.customerName}\n• Сумма: ${invoice.total} ₽\n• Статус: ${invoice.status === "draft" ? "Черновик" : "Проведён"}`;
        },
      }),
    };
  }

  async streamResponse(
    conversationId: number,
    content: string,
    res: Response,
    llmSettings?: LlmSettings,
    erpSettings?: ErpConfig,
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
      console.warn("RAG search failed:", ragError);
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

      // Stream with Vercel AI SDK
      const result = streamText({
        model: aiProvider(modelName),
        system: systemMessage,
        messages,
        tools,
        maxSteps: 3, // Allow up to 3 tool call rounds
        maxTokens: 2048,
        onStepFinish: ({ stepType, toolCalls, toolResults }) => {
          // Send tool call info to client
          if (stepType === "tool-result" && toolCalls && toolResults) {
            for (let i = 0; i < toolCalls.length; i++) {
              res.write(
                `data: ${JSON.stringify({
                  tool_call: toolCalls[i].toolName,
                  tool_result: toolResults[i].result,
                })}\n\n`,
              );
            }
          }
        },
      });

      let fullResponse = "";

      // Stream text deltas to client
      for await (const chunk of result.textStream) {
        if (chunk) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      }

      // Save assistant message
      this.addMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in chat stream:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      } else {
        res.write(
          `data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`,
        );
        res.end();
      }
    }
  }
}
