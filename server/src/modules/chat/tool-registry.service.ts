import { Injectable, Inject } from "@nestjs/common";
import { dynamicTool, jsonSchema, type Tool } from "ai";
import {
  McpHostService,
  type McpServerConfig,
} from "../../services/mcp-host.service";
import { OpenApiToolGeneratorService } from "../../services/openapi-tool-generator.service";
import { ErpService } from "../erp/erp.service";
import { ErpConfig } from "../erp/erp.types";
import { AppLogger } from "../../utils/logger";
import { GuardianGuard } from "../../guards/guardian.guard";
import { SandboxExecutorService } from "../skills/sandbox-executor.service";
import type { ClientRuleDto, ClientSkillDto, MemoryFactDto } from "./chat.dto";

@Injectable()
export class ToolRegistryService {
  private readonly emptySchema = jsonSchema({
    type: "object",
    properties: {},
  });
  constructor(
    @Inject(McpHostService) private mcpHost: McpHostService,
    @Inject(OpenApiToolGeneratorService)
    private openApiGenerator: OpenApiToolGeneratorService,
    @Inject(ErpService) private erpService: ErpService,
    @Inject(GuardianGuard) private guardian: GuardianGuard,
    @Inject(SandboxExecutorService) private sandbox: SandboxExecutorService,
  ) {}

  /**
   * Get all tools for the current session.
   * Merges builtin tools, MCP tools, OpenAPI tools, and User Skills.
   * Rules and skills come from the client payload (zero-storage).
   */
  async getTools(
    userId: string,
    erpSettings?: Partial<ErpConfig>,
    mcpServers: McpServerConfig[] = [],
    clientRules?: ClientRuleDto[],
    clientSkills?: ClientSkillDto[],
    memoryFacts?: MemoryFactDto[],
  ): Promise<Record<string, Tool<unknown, unknown>>> {
    const tools: Record<string, Tool<unknown, unknown>> = {};
    const rules = clientRules ?? [];

    // Helper to wrap execution with validation (rules from payload)
    const wrapExecute = (
      toolName: string,
      execute: (args: Record<string, unknown>) => Promise<unknown>,
    ) => {
      return async (args: unknown) => {
        const castArgs = args as Record<string, unknown>;

        // Use Guardian with rules from client payload
        const guardianResult = await this.guardian.check(
          userId,
          toolName,
          castArgs,
          rules,
        );

        if (!guardianResult.allowed) {
          throw new Error(`Rejected by Guardian: ${guardianResult.message}`);
        }

        if (guardianResult.action === "require_confirmation") {
          AppLogger.warn(
            `Confirmation required for ${toolName}: ${guardianResult.message}`,
            undefined,
            "Guardian",
          );
        }

        return execute(castArgs);
      };
    };

    // 1. Add Built-in Tools
    const builtinTools = this.getBuiltinTools(erpSettings, wrapExecute);
    for (const [name, tool] of Object.entries(builtinTools)) {
      tools[name] = tool;
    }

    // 2. Add MCP Tools
    for (const server of mcpServers) {
      try {
        await this.mcpHost.connect(server);
      } catch (error) {
        AppLogger.error(
          `Failed to connect to MCP server: ${server.name}`,
          error,
          "Registry",
        );
      }
    }

    const mcpToolsList = await this.mcpHost.getAllTools();
    for (const mcpTool of mcpToolsList) {
      tools[mcpTool.name] = dynamicTool({
        description: mcpTool.description,
        inputSchema: mcpTool.inputSchema
          ? jsonSchema(mcpTool.inputSchema)
          : this.emptySchema,
        execute: wrapExecute(mcpTool.name, async (args) => {
          return this.mcpHost.callTool(
            mcpTool.serverName,
            mcpTool.originalName,
            args,
          );
        }),
      });
    }

    // 3. Add OpenAPI Tools
    if (erpSettings?.openApiSpecUrl) {
      const openApiTools = await this.openApiGenerator.generateToolsFromSpec(
        erpSettings.openApiSpecUrl,
        erpSettings.baseUrl,
      );
      for (const [name, tool] of Object.entries(openApiTools)) {
        tools[name] = tool;
      }
    }

    // 4. Add User Skills from client payload (zero-storage)
    const skills = clientSkills ?? [];
    for (const skill of skills) {
      const skillName = `skill_${skill.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      tools[skillName] = dynamicTool({
        description: skill.description || `Execute custom skill: ${skill.name}`,
        inputSchema: skill.inputSchema
          ? jsonSchema(JSON.parse(skill.inputSchema))
          : this.emptySchema,
        execute: wrapExecute(skillName, async (args) => {
          return this.sandbox.execute(skill.code, args);
        }),
      });
    }

    // 5. Memory tools (client persists results)
    const facts = memoryFacts ?? [];

    tools["save_memory"] = dynamicTool({
      description:
        "Save an important fact about the user, their business, or preferences to long-term memory. Use when the user shares persistent info (name, company, preferences, key decisions). The client will persist this locally.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              "Short label for the fact (e.g. 'user_name', 'company', 'preferred_language')",
          },
          value: {
            type: "string",
            description: "The fact value to remember",
          },
        },
        required: ["key", "value"],
        additionalProperties: false,
      }),
      execute: async (args) => {
        const { key, value } = args as { key: string; value: string };
        return JSON.stringify({
          _action: "save_memory",
          key,
          value,
          status: "saved",
        });
      },
    });

    tools["recall_memory"] = dynamicTool({
      description:
        "Search long-term memory for facts about the user. Use when you need context from previous conversations (e.g. user's name, company, past decisions).",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant memory facts",
          },
        },
        required: ["query"],
        additionalProperties: false,
      }),
      execute: async (args) => {
        const { query } = args as { query: string };
        const q = query.toLowerCase();
        const matched = facts.filter(
          (f) =>
            f.key.toLowerCase().includes(q) ||
            f.value.toLowerCase().includes(q),
        );
        if (matched.length === 0) {
          return "No matching facts found in memory.";
        }
        return matched.map((f) => `${f.key}: ${f.value}`).join("\n");
      },
    });

    return tools;
  }

  private getBuiltinTools(
    erpSettings?: Partial<ErpConfig>,
    wrapExecute?: (
      toolName: string,
      execute: (args: Record<string, unknown>) => Promise<unknown>,
    ) => (args: unknown) => Promise<unknown>,
  ) {
    const erpService = this.erpService;
    // Fallback if wrapExecute not provided
    const _wrap =
      wrapExecute ||
      ((
        _name: string,
        exec: (args: Record<string, unknown>) => Promise<unknown>,
      ) =>
        (args: unknown) =>
          exec(args as Record<string, unknown>));

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
        execute: _wrap("get_stock", async (input) => {
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
        }),
      }),

      get_products: dynamicTool({
        description: "Получить список товаров из каталога ERP.",
        inputSchema: getProductsSchema,
        execute: _wrap("get_products", async (input) => {
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
        }),
      }),

      create_invoice: dynamicTool({
        description: "Создать документ реализации (продажи) in ERP.",
        inputSchema: createInvoiceSchema,
        execute: _wrap("create_invoice", async (input) => {
          const invoice = await erpService.createInvoice(
            {
              customerName: input.customer_name as string,
              items: (input.items as Record<string, unknown>[]).map((item) => ({
                productName: item.product_name as string,
                quantity: item.quantity as number,
                price: item.price as number,
              })),
              comment: input.comment as string,
            },
            erpSettings,
          );

          return `Документ создан:\n• Номер: ${invoice.number}\n• Дата: ${new Date(invoice.date).toLocaleDateString("ru-RU")}\n• Покупатель: ${invoice.customerName}\n• Сумма: ${invoice.total} ₽\n• Статус: ${invoice.status === "draft" ? "Черновик" : "Проведён"}`;
        }),
      }),
    };
  }
}
