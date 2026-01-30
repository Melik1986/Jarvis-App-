import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";
import { onesService, type ERPConfig } from "../../modules/ones";
import { ragService } from "../../modules/rag";
import { llmService, type LLMSettings } from "../../modules/llm";

interface RagSettingsRequest {
  provider: "qdrant" | "none";
  qdrant?: {
    url: string;
    apiKey?: string;
    collectionName: string;
  };
}

interface ChatRequestBody {
  content: string;
  llmSettings?: LLMSettings;
  erpSettings?: ERPConfig;
  ragSettings?: RagSettingsRequest;
}

function getOpenAIClient(llmSettings?: LLMSettings): OpenAI {
  if (llmSettings && llmSettings.provider !== "replit") {
    return llmService.createClient(llmSettings);
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

function getModelName(llmSettings?: LLMSettings): string {
  if (llmSettings) {
    return llmService.getModel(llmSettings);
  }
  return "gpt-4o";
}

// System prompt for Jarvis AI assistant
const SYSTEM_PROMPT = `Ты — Jarvis, AI-ассистент для управления бизнес-процессами в 1С.
Ты можешь:
- Проверять остатки товаров на складе (get_stock)
- Получать список товаров (get_products)
- Создавать документы реализации (create_invoice)
- Отвечать на вопросы по регламентам и инструкциям компании

Отвечай кратко и по делу. Используй функции когда это уместно.
При работе с данными 1С всегда показывай результаты в удобном формате.`;

// Tools (Function Calling) for 1C integration
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_stock",
      description:
        "Получить остатки товара на складе по названию. Используй когда пользователь спрашивает о наличии, остатках, количестве товара.",
      parameters: {
        type: "object",
        properties: {
          product_name: {
            type: "string",
            description:
              "Название товара или часть названия для поиска (например: 'кофе', 'молоко', 'сахар')",
          },
        },
        required: ["product_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_products",
      description:
        "Получить список товаров из каталога 1С. Используй когда нужен список товаров или поиск по каталогу.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            description: "Фильтр по названию товара (опционально)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description:
        "Создать документ реализации (продажи) в 1С. Используй когда пользователь хочет оформить продажу или создать накладную.",
      parameters: {
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
                product_name: {
                  type: "string",
                  description: "Название товара",
                },
                quantity: { type: "number", description: "Количество" },
                price: { type: "number", description: "Цена за единицу" },
              },
              required: ["product_name", "quantity", "price"],
            },
            description: "Список товаров в документе",
          },
          comment: {
            type: "string",
            description: "Комментарий к документу (опционально)",
          },
        },
        required: ["items"],
      },
    },
  },
];

/**
 * Execute a tool call and return the result
 */
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  erpConfig?: ERPConfig,
): Promise<string> {
  try {
    switch (toolName) {
      case "get_stock": {
        const productName = args.product_name as string;
        const stock = await onesService.getStock(productName, erpConfig);
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
      }

      case "get_products": {
        const filter = args.filter as string | undefined;
        const products = await onesService.getProducts(filter, erpConfig);
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
      }

      case "create_invoice": {
        const items = (
          args.items as {
            product_name: string;
            quantity: number;
            price: number;
          }[]
        ).map((item) => ({
          productId: "",
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price,
          amount: item.quantity * item.price,
        }));

        const invoice = await onesService.createInvoice(
          {
            customerName: args.customer_name as string,
            items,
            comment: args.comment as string,
          },
          erpConfig,
        );

        return `Документ создан:\n• Номер: ${invoice.number}\n• Дата: ${new Date(invoice.date).toLocaleDateString("ru-RU")}\n• Покупатель: ${invoice.customerName}\n• Сумма: ${invoice.total} ₽\n• Статус: ${invoice.status === "draft" ? "Черновик" : "Проведён"}`;
      }

      default:
        return `Неизвестная функция: ${toolName}`;
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return `Ошибка при выполнении операции: ${error instanceof Error ? error.message : "неизвестная ошибка"}`;
  }
}

export function registerChatRoutes(app: Express): void {
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(
        title || "New Chat",
      );
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message and get AI response (streaming with Function Calling)
  app.post(
    "/api/conversations/:id/messages",
    async (req: Request, res: Response) => {
      try {
        const conversationId = parseInt(req.params.id as string);
        const { content, llmSettings, erpSettings, ragSettings } =
          req.body as ChatRequestBody;

        const openai = getOpenAIClient(llmSettings);
        const modelName = getModelName(llmSettings);

        // Save user message
        await chatStorage.createMessage(conversationId, "user", content);

        // Get conversation history for context
        const dbMessages =
          await chatStorage.getMessagesByConversation(conversationId);

        // Search RAG for relevant context
        let ragContext = "";
        try {
          // Build RAG config from request settings or fallback to env
          const ragConfig =
            ragSettings?.provider === "qdrant" && ragSettings.qdrant?.url
              ? {
                  url: ragSettings.qdrant.url,
                  apiKey: ragSettings.qdrant.apiKey,
                  collectionName:
                    ragSettings.qdrant.collectionName || "kb_jarvis",
                }
              : undefined;
          const ragResults = await ragService.search(content, 2, ragConfig);
          ragContext = ragService.buildContext(ragResults);
        } catch (ragError) {
          console.warn(
            "RAG search failed, continuing without context:",
            ragError,
          );
        }

        // Build messages array with system prompt and RAG context
        const systemMessage = ragContext
          ? `${SYSTEM_PROMPT}\n\n${ragContext}`
          : SYSTEM_PROMPT;

        const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemMessage },
          ...dbMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        // Set up SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let fullResponse = "";
        let toolCallsToProcess: {
          id: string;
          function: { name: string; arguments: string };
        }[] = [];

        // First completion - may include tool calls
        const firstCompletion = await openai.chat.completions.create({
          model: modelName,
          messages: chatMessages,
          tools,
          tool_choice: "auto",
          stream: true,
          max_completion_tokens: 2048,
        });

        // Collect tool calls from stream
        let currentToolCall: {
          id: string;
          function: { name: string; arguments: string };
        } | null = null;

        for await (const chunk of firstCompletion) {
          const choice = chunk.choices[0];

          // Handle content streaming
          const contentDelta = choice?.delta?.content || "";
          if (contentDelta) {
            fullResponse += contentDelta;
            res.write(`data: ${JSON.stringify({ content: contentDelta })}\n\n`);
          }

          // Handle tool calls
          const toolCallDelta = choice?.delta?.tool_calls?.[0];
          if (toolCallDelta) {
            if (toolCallDelta.id) {
              // New tool call starting
              if (currentToolCall) {
                toolCallsToProcess.push(currentToolCall);
              }
              currentToolCall = {
                id: toolCallDelta.id,
                function: {
                  name: toolCallDelta.function?.name || "",
                  arguments: toolCallDelta.function?.arguments || "",
                },
              };
            } else if (currentToolCall) {
              // Continuing existing tool call
              if (toolCallDelta.function?.name) {
                currentToolCall.function.name += toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                currentToolCall.function.arguments +=
                  toolCallDelta.function.arguments;
              }
            }
          }

          // Check if this is the final chunk with tool call
          if (choice?.finish_reason === "tool_calls" && currentToolCall) {
            toolCallsToProcess.push(currentToolCall);
            currentToolCall = null;
          }
        }

        // Process tool calls if any
        if (toolCallsToProcess.length > 0) {
          // Execute each tool call
          const toolResults: {
            role: "tool";
            tool_call_id: string;
            content: string;
          }[] = [];

          for (const toolCall of toolCallsToProcess) {
            const args = JSON.parse(toolCall.function.arguments || "{}");
            const result = await executeToolCall(
              toolCall.function.name,
              args,
              erpSettings,
            );

            // Send tool execution notification to client
            res.write(
              `data: ${JSON.stringify({
                tool_call: toolCall.function.name,
                tool_result: result,
              })}\n\n`,
            );

            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            });
          }

          // Second completion with tool results
          const messagesWithToolResults: OpenAI.Chat.ChatCompletionMessageParam[] =
            [
              ...chatMessages,
              {
                role: "assistant",
                content: fullResponse || null,
                tool_calls: toolCallsToProcess.map((tc) => ({
                  id: tc.id,
                  type: "function" as const,
                  function: tc.function,
                })),
              },
              ...toolResults,
            ];

          const secondCompletion = await openai.chat.completions.create({
            model: modelName,
            messages: messagesWithToolResults,
            stream: true,
            max_completion_tokens: 2048,
          });

          // Stream second response
          for await (const chunk of secondCompletion) {
            const contentDelta = chunk.choices[0]?.delta?.content || "";
            if (contentDelta) {
              fullResponse += contentDelta;
              res.write(
                `data: ${JSON.stringify({ content: contentDelta })}\n\n`,
              );
            }
          }
        }

        // Save assistant message
        await chatStorage.createMessage(
          conversationId,
          "assistant",
          fullResponse,
        );

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (error) {
        console.error("Error sending message:", error);
        // Check if headers already sent (SSE streaming started)
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`,
          );
          res.end();
        } else {
          res.status(500).json({ error: "Failed to send message" });
        }
      }
    },
  );
}
