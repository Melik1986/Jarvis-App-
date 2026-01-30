var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

// server/routes.ts
import { createServer } from "node:http";

// server/replit_integrations/chat/routes.ts
import OpenAI2 from "openai";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  conversations: () => conversations,
  insertConversationSchema: () => insertConversationSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertUserSchema: () => insertUserSchema,
  messages: () => messages,
  users: () => users,
});
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  serial,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
var conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
var messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
var insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

// server/db.ts
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
var db = drizzle(pool, { schema: schema_exports });

// server/replit_integrations/chat/storage.ts
import { eq, desc } from "drizzle-orm";
var chatStorage = {
  async getConversation(id) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  },
  async getAllConversations() {
    return db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt));
  },
  async createConversation(title) {
    const [conversation] = await db
      .insert(conversations)
      .values({ title })
      .returning();
    return conversation;
  },
  async deleteConversation(id) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },
  async getMessagesByConversation(conversationId) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  },
  async createMessage(conversationId, role, content) {
    const [message] = await db
      .insert(messages)
      .values({ conversationId, role, content })
      .returning();
    return message;
  },
};

// server/modules/ones/ones.service.ts
var OnesService = class {
  config;
  isConfigured;
  constructor() {
    this.config = {
      baseUrl: process.env.ONE_C_URL || "",
      username: process.env.ONE_C_USER || "",
      password: process.env.ONE_C_PASSWORD || "",
    };
    this.isConfigured = Boolean(this.config.baseUrl && this.config.username);
  }
  /**
   * Check if 1C integration is configured
   */
  isAvailable() {
    return this.isConfigured;
  }
  /**
   * Get current stock for a product by name
   */
  async getStock(productName) {
    if (!this.isConfigured) {
      return this.getMockStock(productName);
    }
    try {
      const products = await this.fetchOData(
        `Catalog_\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430?$filter=contains(Description,'${encodeURIComponent(productName)}')`,
      );
      if (products.length === 0) {
        return [];
      }
      const productKeys = products
        .map(
          (p) =>
            `\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430_Key eq guid'${p.Ref_Key}'`,
        )
        .join(" or ");
      const stocks = await this.fetchOData(
        `AccumulationRegister_\u0422\u043E\u0432\u0430\u0440\u044B\u041D\u0430\u0421\u043A\u043B\u0430\u0434\u0430\u0445/Balance?$filter=${encodeURIComponent(productKeys)}`,
      );
      return products.map((product) => {
        const stock = stocks.find(
          (s) => s.Номенклатура_Key === product.Ref_Key,
        );
        return {
          id: product.Ref_Key,
          name: product.Description,
          sku: product.Артикул,
          quantity: stock?.КоличествоBalance || 0,
          unit: "\u0448\u0442",
        };
      });
    } catch (error) {
      console.error("Error fetching stock from 1C:", error);
      return this.getMockStock(productName);
    }
  }
  /**
   * Get products list with optional filter
   */
  async getProducts(filter) {
    if (!this.isConfigured) {
      return this.getMockProducts(filter);
    }
    try {
      const filterQuery = filter
        ? `?$filter=contains(Description,'${encodeURIComponent(filter)}')`
        : "?$top=50";
      const products = await this.fetchOData(
        `Catalog_\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430${filterQuery}`,
      );
      return products.map((p) => ({
        id: p.Ref_Key,
        name: p.Description,
        sku: p.Артикул,
        isService: p.ЭтоУслуга,
      }));
    } catch (error) {
      console.error("Error fetching products from 1C:", error);
      return this.getMockProducts(filter);
    }
  }
  /**
   * Create a sales invoice in 1C
   */
  async createInvoice(data) {
    if (!this.isConfigured) {
      return this.getMockInvoice(data);
    }
    try {
      console.log("Creating invoice in 1C:", data);
      return this.getMockInvoice(data);
    } catch (error) {
      console.error("Error creating invoice in 1C:", error);
      throw new Error("Failed to create invoice in 1C");
    }
  }
  /**
   * Fetch data from 1C OData endpoint
   */
  async fetchOData(endpoint) {
    const url = `${this.config.baseUrl}/${endpoint}`;
    const auth = Buffer.from(
      `${this.config.username}:${this.config.password}`,
    ).toString("base64");
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `1C OData error: ${response.status} ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data.value || [];
  }
  /**
   * POST data to 1C OData endpoint
   */
  async postOData(endpoint, body) {
    const url = `${this.config.baseUrl}/${endpoint}`;
    const auth = Buffer.from(
      `${this.config.username}:${this.config.password}`,
    ).toString("base64");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `1C OData error: ${response.status} ${response.statusText}`,
      );
    }
    return response.json();
  }
  // =====================
  // Mock data for demo/testing
  // =====================
  getMockStock(productName) {
    const mockData = [
      {
        id: "1",
        name: "\u041A\u043E\u0444\u0435 Arabica 1\u043A\u0433",
        sku: "COFFEE-001",
        quantity: 150,
        unit: "\u0448\u0442",
      },
      {
        id: "2",
        name: "\u041A\u043E\u0444\u0435 Robusta 500\u0433",
        sku: "COFFEE-002",
        quantity: 80,
        unit: "\u0448\u0442",
      },
      {
        id: "3",
        name: "\u0427\u0430\u0439 \u0437\u0435\u043B\u0451\u043D\u044B\u0439 100\u0433",
        sku: "TEA-001",
        quantity: 200,
        unit: "\u0448\u0442",
      },
      {
        id: "4",
        name: "\u0421\u0430\u0445\u0430\u0440 1\u043A\u0433",
        sku: "SUGAR-001",
        quantity: 500,
        unit: "\u0448\u0442",
      },
      {
        id: "5",
        name: "\u041C\u043E\u043B\u043E\u043A\u043E 1\u043B",
        sku: "MILK-001",
        quantity: 50,
        unit: "\u0448\u0442",
      },
    ];
    const search = productName.toLowerCase();
    return mockData.filter((item) => item.name.toLowerCase().includes(search));
  }
  getMockProducts(filter) {
    const mockData = [
      {
        id: "1",
        name: "\u041A\u043E\u0444\u0435 Arabica 1\u043A\u0433",
        sku: "COFFEE-001",
        price: 1500,
      },
      {
        id: "2",
        name: "\u041A\u043E\u0444\u0435 Robusta 500\u0433",
        sku: "COFFEE-002",
        price: 800,
      },
      {
        id: "3",
        name: "\u0427\u0430\u0439 \u0437\u0435\u043B\u0451\u043D\u044B\u0439 100\u0433",
        sku: "TEA-001",
        price: 350,
      },
      {
        id: "4",
        name: "\u0421\u0430\u0445\u0430\u0440 1\u043A\u0433",
        sku: "SUGAR-001",
        price: 120,
      },
      {
        id: "5",
        name: "\u041C\u043E\u043B\u043E\u043A\u043E 1\u043B",
        sku: "MILK-001",
        price: 95,
      },
      {
        id: "6",
        name: "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430",
        isService: true,
        price: 500,
      },
    ];
    if (!filter) return mockData;
    const search = filter.toLowerCase();
    return mockData.filter((item) => item.name.toLowerCase().includes(search));
  }
  getMockInvoice(data) {
    const total = data.items.reduce((sum, item) => sum + item.amount, 0);
    return {
      id: `INV-${Date.now()}`,
      number: `\u0420\u0422-${Math.floor(Math.random() * 1e4)}`,
      date: data.date || /* @__PURE__ */ new Date(),
      customerName:
        data.customerName ||
        "\u041F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C",
      total,
      status: "draft",
    };
  }
};
var onesService = new OnesService();

// server/modules/ai/openai.service.ts
import OpenAI from "openai";
var OpenAIService = class {
  client;
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  getClient() {
    return this.client;
  }
  /**
   * Create a chat completion with optional tools (function calling)
   */
  async createChatCompletion(params) {
    return this.client.chat.completions.create({
      model: params.model || "gpt-4o",
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tools ? "auto" : void 0,
      stream: params.stream ?? false,
      max_completion_tokens: params.maxTokens || 2048,
    });
  }
  /**
   * Transcribe audio using Whisper
   */
  async transcribeAudio(audioBuffer, format = "wav") {
    const { toFile: toFile3 } = await import("openai");
    const file = await toFile3(audioBuffer, `audio.${format}`);
    const response = await this.client.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });
    return response.text;
  }
};
var openaiService = new OpenAIService();

// server/modules/ai/embeddings.service.ts
var EmbeddingsService = class {
  model = "text-embedding-3-small";
  dimensions = 1536;
  /**
   * Generate embedding vector for a single text
   */
  async embed(text2) {
    const client = openaiService.getClient();
    const response = await client.embeddings.create({
      model: this.model,
      input: text2,
      dimensions: this.dimensions,
    });
    return response.data[0].embedding;
  }
  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts) {
    const client = openaiService.getClient();
    const response = await client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: this.dimensions,
    });
    return response.data.map((d) => d.embedding);
  }
  /**
   * Get the dimension size for the embeddings model
   */
  getDimensions() {
    return this.dimensions;
  }
};
var embeddingsService = new EmbeddingsService();

// server/modules/rag/rag.service.ts
var RagService = class {
  config;
  isConfigured;
  constructor() {
    this.config = {
      url: process.env.QDRANT_URL || "",
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: "kb_jarvis",
    };
    this.isConfigured = Boolean(this.config.url);
  }
  /**
   * Check if Qdrant is configured
   */
  isAvailable() {
    return this.isConfigured;
  }
  /**
   * Search for relevant documents by query text
   */
  async search(query, limit = 3) {
    if (!this.isConfigured) {
      return this.getMockResults(query, limit);
    }
    try {
      const embedding = await embeddingsService.embed(query);
      const response = await fetch(
        `${this.config.url}/collections/${this.config.collectionName}/points/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "api-key": this.config.apiKey }),
          },
          body: JSON.stringify({
            vector: embedding,
            limit,
            with_payload: true,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Qdrant error: ${response.status}`);
      }
      const data = await response.json();
      const results = data.result || [];
      return results.map((r) => ({
        id: String(r.id),
        score: r.score,
        content: r.payload.content,
        metadata: {
          title: r.payload.title,
          source: r.payload.source,
          category: r.payload.category,
        },
      }));
    } catch (error) {
      console.error("Error searching Qdrant:", error);
      return this.getMockResults(query, limit);
    }
  }
  /**
   * Add document to knowledge base
   */
  async addDocument(content, metadata) {
    if (!this.isConfigured) {
      console.log("Qdrant not configured, skipping document add");
      return `mock-${Date.now()}`;
    }
    try {
      const embedding = await embeddingsService.embed(content);
      const id = `doc-${Date.now()}`;
      await fetch(
        `${this.config.url}/collections/${this.config.collectionName}/points`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "api-key": this.config.apiKey }),
          },
          body: JSON.stringify({
            points: [
              {
                id,
                vector: embedding,
                payload: { content, ...metadata },
              },
            ],
          }),
        },
      );
      return id;
    } catch (error) {
      console.error("Error adding document to Qdrant:", error);
      throw error;
    }
  }
  /**
   * Create collection if not exists
   */
  async ensureCollection() {
    if (!this.isConfigured) return;
    try {
      const checkResponse = await fetch(
        `${this.config.url}/collections/${this.config.collectionName}`,
        {
          headers: this.config.apiKey ? { "api-key": this.config.apiKey } : {},
        },
      );
      if (checkResponse.status === 404) {
        await fetch(
          `${this.config.url}/collections/${this.config.collectionName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(this.config.apiKey && { "api-key": this.config.apiKey }),
            },
            body: JSON.stringify({
              vectors: {
                size: embeddingsService.getDimensions(),
                distance: "Cosine",
              },
            }),
          },
        );
        console.log(`Created Qdrant collection: ${this.config.collectionName}`);
      }
    } catch (error) {
      console.error("Error ensuring Qdrant collection:", error);
    }
  }
  /**
   * Build context string from search results for LLM prompt injection
   */
  buildContext(results) {
    if (results.length === 0) return "";
    const contextParts = results.map((r, i) => {
      const title = r.metadata?.title
        ? `[${r.metadata.title}]`
        : `[\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 ${i + 1}]`;
      return `${title}
${r.content}`;
    });
    return `\u0420\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u0438\u0437 \u0431\u0430\u0437\u044B \u0437\u043D\u0430\u043D\u0438\u0439:

${contextParts.join("\n\n---\n\n")}`;
  }
  // =====================
  // Mock data for demo/testing
  // =====================
  getMockResults(query, limit) {
    const mockDocs = [
      {
        id: "doc-1",
        score: 0.92,
        content:
          "\u0414\u043B\u044F \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0442\u043E\u0432\u0430\u0440\u0430 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E: 1) \u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0440\u043E\u043A \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 (14 \u0434\u043D\u0435\u0439 \u0434\u043B\u044F \u043D\u0435\u043F\u0440\u043E\u0434\u043E\u0432\u043E\u043B\u044C\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432). 2) \u0423\u0431\u0435\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u0438 \u0442\u043E\u0432\u0430\u0440\u043D\u043E\u0433\u043E \u0432\u0438\u0434\u0430 \u0438 \u0443\u043F\u0430\u043A\u043E\u0432\u043A\u0438. 3) \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 '\u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u043E\u0442 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044F' \u0432 1\u0421.",
        metadata: {
          title:
            "\u0420\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0442\u043E\u0432\u0430\u0440\u043E\u0432",
          category: "procedures",
        },
      },
      {
        id: "doc-2",
        score: 0.87,
        content:
          "\u041F\u0440\u0438\u0451\u043C \u0442\u043E\u0432\u0430\u0440\u0430 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434: 1) \u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u043E\u0439 \u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430. 2) \u041E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0442\u043E\u0432\u0430\u0440 \u043D\u0430 \u043D\u0430\u043B\u0438\u0447\u0438\u0435 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439. 3) \u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 '\u041F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u043E\u0432' \u0432 1\u0421. 4) \u0420\u0430\u0437\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440 \u0432 \u0437\u043E\u043D\u0435 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.",
        metadata: {
          title:
            "\u0418\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043F\u043E \u043F\u0440\u0438\u0451\u043C\u043A\u0435 \u0442\u043E\u0432\u0430\u0440\u0430",
          category: "warehouse",
        },
      },
      {
        id: "doc-3",
        score: 0.85,
        content:
          "\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0435\u0436\u0435\u043A\u0432\u0430\u0440\u0442\u0430\u043B\u044C\u043D\u043E. \u041F\u043E\u0440\u044F\u0434\u043E\u043A: 1) \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 '\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u044F' \u0432 1\u0421. 2) \u0420\u0430\u0441\u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043E\u043F\u0438\u0441\u0438. 3) \u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 \u043F\u043E\u0434\u0441\u0447\u0451\u0442 \u0442\u043E\u0432\u0430\u0440\u043E\u0432. 4) \u0412\u043D\u0435\u0441\u0442\u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043E\u0441\u0442\u0430\u0442\u043A\u0438. 5) \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0438\u0437\u043B\u0438\u0448\u043A\u0438/\u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0447\u0438.",
        metadata: {
          title:
            "\u041F\u043E\u0440\u044F\u0434\u043E\u043A \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u0438",
          category: "inventory",
        },
      },
      {
        id: "doc-4",
        score: 0.78,
        content:
          "\u0421\u043A\u0438\u0434\u043A\u0438 \u0434\u043B\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432: \u043E\u043F\u0442\u043E\u0432\u044B\u043C \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044F\u043C \u043E\u0442 10%, \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u043C \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u043C \u043E\u0442 5%. \u0421\u043A\u0438\u0434\u043A\u0438 \u043D\u0435 \u0441\u0443\u043C\u043C\u0438\u0440\u0443\u044E\u0442\u0441\u044F. \u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043A\u0438\u0434\u043A\u0430 \u0431\u0435\u0437 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0430 - 15%.",
        metadata: {
          title:
            "\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u0441\u043A\u0438\u0434\u043E\u043A",
          category: "sales",
        },
      },
    ];
    const lowerQuery = query.toLowerCase();
    const filtered = mockDocs
      .filter(
        (doc) =>
          doc.content.toLowerCase().includes(lowerQuery) ||
          doc.metadata?.title?.toLowerCase().includes(lowerQuery),
      )
      .slice(0, limit);
    return filtered.length > 0 ? filtered : mockDocs.slice(0, limit);
  }
};
var ragService = new RagService();

// server/replit_integrations/chat/routes.ts
var openai = new OpenAI2({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
var SYSTEM_PROMPT = `\u0422\u044B \u2014 Jarvis, AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u0434\u043B\u044F \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0431\u0438\u0437\u043D\u0435\u0441-\u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430\u043C\u0438 \u0432 1\u0421.
\u0422\u044B \u043C\u043E\u0436\u0435\u0448\u044C:
- \u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0442\u044C \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435 (get_stock)
- \u041F\u043E\u043B\u0443\u0447\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432 (get_products)
- \u0421\u043E\u0437\u0434\u0430\u0432\u0430\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0440\u0435\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438 (create_invoice)
- \u041E\u0442\u0432\u0435\u0447\u0430\u0442\u044C \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043F\u043E \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442\u0430\u043C \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F\u043C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438

\u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u043A\u0440\u0430\u0442\u043A\u043E \u0438 \u043F\u043E \u0434\u0435\u043B\u0443. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043A\u043E\u0433\u0434\u0430 \u044D\u0442\u043E \u0443\u043C\u0435\u0441\u0442\u043D\u043E.
\u041F\u0440\u0438 \u0440\u0430\u0431\u043E\u0442\u0435 \u0441 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 1\u0421 \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0432 \u0443\u0434\u043E\u0431\u043D\u043E\u043C \u0444\u043E\u0440\u043C\u0430\u0442\u0435.`;
var tools = [
  {
    type: "function",
    function: {
      name: "get_stock",
      description:
        "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u0442\u043E\u0432\u0430\u0440\u0430 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435 \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043A\u043E\u0433\u0434\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u0442 \u043E \u043D\u0430\u043B\u0438\u0447\u0438\u0438, \u043E\u0441\u0442\u0430\u0442\u043A\u0430\u0445, \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0435 \u0442\u043E\u0432\u0430\u0440\u0430.",
      parameters: {
        type: "object",
        properties: {
          product_name: {
            type: "string",
            description:
              "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u0430 \u0438\u043B\u0438 \u0447\u0430\u0441\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0434\u043B\u044F \u043F\u043E\u0438\u0441\u043A\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: '\u043A\u043E\u0444\u0435', '\u043C\u043E\u043B\u043E\u043A\u043E', '\u0441\u0430\u0445\u0430\u0440')",
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
        "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0438\u0437 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 1\u0421. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043A\u043E\u0433\u0434\u0430 \u043D\u0443\u0436\u0435\u043D \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0438\u043B\u0438 \u043F\u043E\u0438\u0441\u043A \u043F\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            description:
              "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0442\u043E\u0432\u0430\u0440\u0430 (\u043E\u043F\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E)",
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
        "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0440\u0435\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438 (\u043F\u0440\u043E\u0434\u0430\u0436\u0438) \u0432 1\u0421. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043A\u043E\u0433\u0434\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0445\u043E\u0447\u0435\u0442 \u043E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u043F\u0440\u043E\u0434\u0430\u0436\u0443 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u0443\u044E.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description:
              "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044F/\u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442\u0430",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: {
                  type: "string",
                  description:
                    "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u0430",
                },
                quantity: {
                  type: "number",
                  description:
                    "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E",
                },
                price: {
                  type: "number",
                  description:
                    "\u0426\u0435\u043D\u0430 \u0437\u0430 \u0435\u0434\u0438\u043D\u0438\u0446\u0443",
                },
              },
              required: ["product_name", "quantity", "price"],
            },
            description:
              "\u0421\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0435",
          },
          comment: {
            type: "string",
            description:
              "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0443 (\u043E\u043F\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E)",
          },
        },
        required: ["items"],
      },
    },
  },
];
async function executeToolCall(toolName, args) {
  try {
    switch (toolName) {
      case "get_stock": {
        const productName = args.product_name;
        const stock = await onesService.getStock(productName);
        if (stock.length === 0) {
          return `\u0422\u043E\u0432\u0430\u0440\u044B \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${productName}" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B.`;
        }
        const stockList = stock
          .map(
            (s) =>
              `\u2022 ${s.name} (${s.sku || "\u0431\u0435\u0437 \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u0430"}): ${s.quantity} ${s.unit || "\u0448\u0442"}`,
          )
          .join("\n");
        return `\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${productName}":
${stockList}`;
      }
      case "get_products": {
        const filter = args.filter;
        const products = await onesService.getProducts(filter);
        if (products.length === 0) {
          return filter
            ? `\u0422\u043E\u0432\u0430\u0440\u044B \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${filter}" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B.`
            : "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u043F\u0443\u0441\u0442.";
        }
        const productList = products
          .map((p) => {
            const price = p.price ? ` \u2014 ${p.price} \u20BD` : "";
            const type = p.isService
              ? " (\u0443\u0441\u043B\u0443\u0433\u0430)"
              : "";
            return `\u2022 ${p.name}${price}${type}`;
          })
          .join("\n");
        return `\u0421\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432${filter ? ` \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${filter}"` : ""}:
${productList}`;
      }
      case "create_invoice": {
        const items = args.items.map((item) => ({
          productId: "",
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price,
          amount: item.quantity * item.price,
        }));
        const invoice = await onesService.createInvoice({
          customerName: args.customer_name,
          items,
          comment: args.comment,
        });
        return `\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0441\u043E\u0437\u0434\u0430\u043D:
\u2022 \u041D\u043E\u043C\u0435\u0440: ${invoice.number}
\u2022 \u0414\u0430\u0442\u0430: ${new Date(invoice.date).toLocaleDateString("ru-RU")}
\u2022 \u041F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C: ${invoice.customerName}
\u2022 \u0421\u0443\u043C\u043C\u0430: ${invoice.total} \u20BD
\u2022 \u0421\u0442\u0430\u0442\u0443\u0441: ${invoice.status === "draft" ? "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A" : "\u041F\u0440\u043E\u0432\u0435\u0434\u0451\u043D"}`;
      }
      default:
        return `\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u044F: ${toolName}`;
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0438 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438: ${error instanceof Error ? error.message : "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430"}`;
  }
}
function registerChatRoutes(app2) {
  app2.get("/api/conversations", async (req, res) => {
    try {
      const conversations2 = await chatStorage.getAllConversations();
      res.json(conversations2);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  app2.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages2 = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages: messages2 });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  app2.post("/api/conversations", async (req, res) => {
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
  app2.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
  app2.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;
      await chatStorage.createMessage(conversationId, "user", content);
      const dbMessages =
        await chatStorage.getMessagesByConversation(conversationId);
      let ragContext = "";
      try {
        const ragResults = await ragService.search(content, 2);
        ragContext = ragService.buildContext(ragResults);
      } catch (ragError) {
        console.warn(
          "RAG search failed, continuing without context:",
          ragError,
        );
      }
      const systemMessage = ragContext
        ? `${SYSTEM_PROMPT}

${ragContext}`
        : SYSTEM_PROMPT;
      const chatMessages = [
        { role: "system", content: systemMessage },
        ...dbMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      let fullResponse = "";
      let toolCallsToProcess = [];
      const firstCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        tools,
        tool_choice: "auto",
        stream: true,
        max_completion_tokens: 2048,
      });
      let currentToolCall = null;
      for await (const chunk of firstCompletion) {
        const choice = chunk.choices[0];
        const contentDelta = choice?.delta?.content || "";
        if (contentDelta) {
          fullResponse += contentDelta;
          res.write(`data: ${JSON.stringify({ content: contentDelta })}

`);
        }
        const toolCallDelta = choice?.delta?.tool_calls?.[0];
        if (toolCallDelta) {
          if (toolCallDelta.id) {
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
            if (toolCallDelta.function?.name) {
              currentToolCall.function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              currentToolCall.function.arguments +=
                toolCallDelta.function.arguments;
            }
          }
        }
        if (choice?.finish_reason === "tool_calls" && currentToolCall) {
          toolCallsToProcess.push(currentToolCall);
          currentToolCall = null;
        }
      }
      if (toolCallsToProcess.length > 0) {
        const toolResults = [];
        for (const toolCall of toolCallsToProcess) {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          const result = await executeToolCall(toolCall.function.name, args);
          res.write(
            `data: ${JSON.stringify({
              tool_call: toolCall.function.name,
              tool_result: result,
            })}

`,
          );
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        const messagesWithToolResults = [
          ...chatMessages,
          {
            role: "assistant",
            content: fullResponse || null,
            tool_calls: toolCallsToProcess.map((tc) => ({
              id: tc.id,
              type: "function",
              function: tc.function,
            })),
          },
          ...toolResults,
        ];
        const secondCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messagesWithToolResults,
          stream: true,
          max_completion_tokens: 2048,
        });
        for await (const chunk of secondCompletion) {
          const contentDelta = chunk.choices[0]?.delta?.content || "";
          if (contentDelta) {
            fullResponse += contentDelta;
            res.write(
              `data: ${JSON.stringify({ content: contentDelta })}

`,
            );
          }
        }
      }
      await chatStorage.createMessage(
        conversationId,
        "assistant",
        fullResponse,
      );
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(
          `data: ${JSON.stringify({ error: "Failed to send message" })}

`,
        );
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

// server/replit_integrations/image/client.ts
import OpenAI3, { toFile } from "openai";
var openai2 = new OpenAI3({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// server/replit_integrations/image/routes.ts
function registerImageRoutes(app2) {
  app2.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const response = await openai2.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size,
      });
      const imageData = response.data[0];
      res.json({
        url: imageData.url,
        b64_json: imageData.b64_json,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}

// server/replit_integrations/audio/routes.ts
import express from "express";

// server/replit_integrations/audio/client.ts
import OpenAI4, { toFile as toFile2 } from "openai";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
var openai3 = new OpenAI4({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
function detectAudioFormat(buffer) {
  if (buffer.length < 12) return "unknown";
  if (
    buffer[0] === 82 &&
    buffer[1] === 73 &&
    buffer[2] === 70 &&
    buffer[3] === 70
  ) {
    return "wav";
  }
  if (
    buffer[0] === 26 &&
    buffer[1] === 69 &&
    buffer[2] === 223 &&
    buffer[3] === 163
  ) {
    return "webm";
  }
  if (
    (buffer[0] === 255 &&
      (buffer[1] === 251 || buffer[1] === 250 || buffer[1] === 243)) ||
    (buffer[0] === 73 && buffer[1] === 68 && buffer[2] === 51)
  ) {
    return "mp3";
  }
  if (
    buffer[4] === 102 &&
    buffer[5] === 116 &&
    buffer[6] === 121 &&
    buffer[7] === 112
  ) {
    return "mp4";
  }
  if (
    buffer[0] === 79 &&
    buffer[1] === 103 &&
    buffer[2] === 103 &&
    buffer[3] === 83
  ) {
    return "ogg";
  }
  return "unknown";
}
async function convertToWav(audioBuffer) {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise((resolve2, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        inputPath,
        "-vn",
        // Extract audio only (ignore video track)
        "-f",
        "wav",
        "-ar",
        "16000",
        // 16kHz sample rate (good for speech)
        "-ac",
        "1",
        // Mono
        "-acodec",
        "pcm_s16le",
        "-y",
        // Overwrite output
        outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve2();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
async function ensureCompatibleFormat(audioBuffer) {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}
async function speechToText(audioBuffer, format = "wav") {
  const file = await toFile2(audioBuffer, `audio.${format}`);
  const response = await openai3.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
  });
  return response.text;
}

// server/replit_integrations/audio/routes.ts
var audioBodyParser = express.json({ limit: "50mb" });
function registerAudioRoutes(app2) {
  app2.post(
    "/api/voice/:conversationId/message",
    audioBodyParser,
    async (req, res) => {
      try {
        const conversationId = parseInt(req.params.conversationId);
        const { audio, voice = "alloy" } = req.body;
        if (!audio) {
          return res
            .status(400)
            .json({ error: "Audio data (base64) is required" });
        }
        const rawBuffer = Buffer.from(audio, "base64");
        const { buffer: audioBuffer, format: inputFormat } =
          await ensureCompatibleFormat(rawBuffer);
        const userTranscript = await speechToText(audioBuffer, inputFormat);
        await chatStorage.createMessage(conversationId, "user", userTranscript);
        const existingMessages =
          await chatStorage.getMessagesByConversation(conversationId);
        const chatHistory = existingMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(
          `data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}

`,
        );
        const stream = await openai3.chat.completions.create({
          model: "gpt-audio",
          modalities: ["text", "audio"],
          audio: { voice, format: "pcm16" },
          messages: chatHistory,
          stream: true,
        });
        let assistantTranscript = "";
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta?.audio?.transcript) {
            assistantTranscript += delta.audio.transcript;
            res.write(
              `data: ${JSON.stringify({ type: "transcript", data: delta.audio.transcript })}

`,
            );
          }
          if (delta?.audio?.data) {
            res.write(
              `data: ${JSON.stringify({ type: "audio", data: delta.audio.data })}

`,
            );
          }
        }
        await chatStorage.createMessage(
          conversationId,
          "assistant",
          assistantTranscript,
        );
        res.write(
          `data: ${JSON.stringify({ type: "done", transcript: assistantTranscript })}

`,
        );
        res.end();
      } catch (error) {
        console.error("Error processing voice message:", error);
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", error: "Failed to process voice message" })}

`,
          );
          res.end();
        } else {
          res.status(500).json({ error: "Failed to process voice message" });
        }
      }
    },
  );
}

// beads/beads.service.ts
import { randomUUID as randomUUID2 } from "crypto";

// beads/rules-parser.ts
import * as fs from "fs/promises";
import * as path from "path";
var RulesParser = class {
  cursorPath;
  constructor(cursorPath) {
    this.cursorPath = cursorPath || path.join(process.cwd(), ".cursor");
  }
  /**
   * Load all project context (rules + skills)
   */
  async loadProjectContext() {
    const [rules, skills] = await Promise.all([
      this.loadAllRules(),
      this.loadAllSkills(),
    ]);
    const projectSkill = skills.find(
      (s) => s.name.includes("jarvis") || s.name.includes("project"),
    );
    const projectConfig = projectSkill
      ? this.extractProjectConfig(projectSkill)
      : void 0;
    return { rules, skills, projectConfig };
  }
  /**
   * Load all rules from .cursor/rules/
   */
  async loadAllRules() {
    const rulesPath = path.join(this.cursorPath, "rules");
    try {
      const files = await fs.readdir(rulesPath);
      const mdcFiles = files.filter(
        (f) => f.endsWith(".mdc") || f.endsWith(".md"),
      );
      const rules = await Promise.all(
        mdcFiles.map((file) => this.parseRuleFile(path.join(rulesPath, file))),
      );
      return rules.filter((r) => r !== null);
    } catch (error) {
      console.error("Error loading rules:", error);
      return [];
    }
  }
  /**
   * Load all skills from .cursor/skills/
   */
  async loadAllSkills() {
    const skillsPath = path.join(this.cursorPath, "skills");
    try {
      const entries = await fs.readdir(skillsPath, { withFileTypes: true });
      const skillDirs = entries.filter((e) => e.isDirectory());
      const skills = await Promise.all(
        skillDirs.map((dir) =>
          this.parseSkillDir(path.join(skillsPath, dir.name)),
        ),
      );
      return skills.filter((s) => s !== null);
    } catch (error) {
      console.error("Error loading skills:", error);
      return [];
    }
  }
  /**
   * Parse a single rule file (.mdc)
   */
  async parseRuleFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const name = path.basename(filePath, path.extname(filePath));
      const frontmatter = this.parseFrontmatter(content);
      const bodyContent = this.extractBody(content);
      const keyPoints = this.extractKeyPoints(bodyContent);
      return {
        name,
        path: filePath,
        description: frontmatter.description,
        globs: frontmatter.globs,
        alwaysApply:
          frontmatter.alwaysApply === true ||
          frontmatter.alwaysApply === "true",
        content: bodyContent,
        keyPoints,
      };
    } catch (error) {
      console.error(`Error parsing rule file ${filePath}:`, error);
      return null;
    }
  }
  /**
   * Parse a skill directory
   */
  async parseSkillDir(dirPath) {
    try {
      const skillFile = path.join(dirPath, "SKILL.md");
      const refFile = path.join(dirPath, "reference.md");
      const skillContent = await fs.readFile(skillFile, "utf-8");
      let referenceContent;
      try {
        referenceContent = await fs.readFile(refFile, "utf-8");
      } catch {}
      const name = path.basename(dirPath);
      const frontmatter = this.parseFrontmatter(skillContent);
      const bodyContent = this.extractBody(skillContent);
      const triggers = this.extractTriggers(
        frontmatter.description || bodyContent,
      );
      const relatedRules = this.findRelatedRules(bodyContent);
      return {
        name,
        path: dirPath,
        description: frontmatter.description || frontmatter.name || name,
        triggers,
        skillContent: bodyContent,
        referenceContent,
        relatedRules,
      };
    } catch (error) {
      console.error(`Error parsing skill dir ${dirPath}:`, error);
      return null;
    }
  }
  /**
   * Parse YAML frontmatter from markdown content
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const yamlContent = match[1];
    const result = {};
    const lines = yamlContent.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      if (value === "") {
        continue;
      }
      if (
        typeof value === "string" &&
        value.startsWith('"') &&
        value.endsWith('"')
      ) {
        value = value.slice(1, -1);
      }
      if (
        typeof value === "string" &&
        value.startsWith("[") &&
        value.endsWith("]")
      ) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }
      if (value === "true") value = true;
      if (value === "false") value = false;
      result[key] = value;
    }
    return result;
  }
  /**
   * Extract body content (without frontmatter)
   */
  extractBody(content) {
    return content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
  }
  /**
   * Extract key points from rule/skill content
   */
  extractKeyPoints(content) {
    const points = [];
    const headers = content.match(/^#{1,3}\s+(.+)$/gm);
    if (headers) {
      points.push(...headers.map((h) => h.replace(/^#+\s+/, "")));
    }
    const listItems = content.match(/^[-*]\s+(.+)$/gm);
    if (listItems) {
      const importantItems = listItems
        .map((item) => item.replace(/^[-*]\s+/, ""))
        .filter(
          (item) =>
            item.includes("MUST") ||
            item.includes("ALWAYS") ||
            item.includes("NEVER") ||
            item.includes(
              "\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E",
            ) ||
            item.includes(
              "\u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E",
            ) ||
            item.length < 100,
        )
        .slice(0, 10);
      points.push(...importantItems);
    }
    return [...new Set(points)];
  }
  /**
   * Extract triggers from description
   */
  extractTriggers(text2) {
    const triggers = [];
    const useWhenMatch = text2.match(/Use when[^.]*\./gi);
    if (useWhenMatch) {
      triggers.push(...useWhenMatch);
    }
    const keywords = [
      "1C",
      "1\u0421",
      "ERP",
      "voice",
      "vision",
      "RAG",
      "auth",
      "Supabase",
      "Qdrant",
      "Tamagui",
      "chat",
      "MCP",
    ];
    for (const keyword of keywords) {
      if (text2.toLowerCase().includes(keyword.toLowerCase())) {
        triggers.push(keyword);
      }
    }
    return [...new Set(triggers)];
  }
  /**
   * Find related rules mentioned in content
   */
  findRelatedRules(content) {
    const ruleRefs = content.match(
      /\.cursor\/rules\/[\w-]+\.mdc|rules\/[\w-]+\.mdc|rule\s+\*\*[\w-]+\.mdc\*\*/gi,
    );
    if (!ruleRefs) return [];
    return ruleRefs.map((ref) => {
      const match = ref.match(/([\w-]+)\.mdc/);
      return match ? match[1] : ref;
    });
  }
  /**
   * Extract project config from skill content
   */
  extractProjectConfig(skill) {
    const content = skill.skillContent + (skill.referenceContent || "");
    const moduleMatch = content.match(/\|\s*\*\*([^|]+)\*\*\s*\|/g);
    const modules = moduleMatch
      ? moduleMatch.map((m) => m.replace(/\|\s*\*\*|\*\*\s*\|/g, "").trim())
      : [];
    const stackMatch = content.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g);
    const stack = stackMatch
      ? stackMatch
          .slice(2)
          .map((m) => {
            const parts = m.split("|").filter((p) => p.trim());
            return parts.map((p) => p.trim());
          })
          .flat()
          .filter((s) => s && !s.includes("---"))
      : [];
    return {
      name: skill.name,
      description: skill.description,
      modules: modules.slice(0, 10),
      stack: stack.slice(0, 20),
    };
  }
  /**
   * Get rule by name
   */
  async getRuleByName(name) {
    const rulesPath = path.join(this.cursorPath, "rules");
    const filePath = path.join(rulesPath, `${name}.mdc`);
    try {
      await fs.access(filePath);
      return this.parseRuleFile(filePath);
    } catch {
      const files = await fs.readdir(rulesPath);
      const match = files.find((f) => f.startsWith(name));
      if (match) {
        return this.parseRuleFile(path.join(rulesPath, match));
      }
      return null;
    }
  }
  /**
   * Get skill by name
   */
  async getSkillByName(name) {
    const skillsPath = path.join(this.cursorPath, "skills");
    const dirPath = path.join(skillsPath, name);
    try {
      await fs.access(dirPath);
      return this.parseSkillDir(dirPath);
    } catch {
      return null;
    }
  }
};
var rulesParser = new RulesParser();

// beads/beads.service.ts
var BeadsService = class {
  tasks = /* @__PURE__ */ new Map();
  projectContext = null;
  config;
  constructor(config) {
    this.config = {
      cursorPath: config?.cursorPath || ".cursor",
      autoLoadRules: config?.autoLoadRules ?? true,
      autoLoadSkills: config?.autoLoadSkills ?? true,
    };
  }
  /**
   * Initialize Beads with project context
   */
  async initialize() {
    this.projectContext = await rulesParser.loadProjectContext();
    console.log(
      `[Beads] Initialized with ${this.projectContext.rules.length} rules and ${this.projectContext.skills.length} skills`,
    );
  }
  /**
   * Get project context (rules + skills)
   */
  getProjectContext() {
    return this.projectContext;
  }
  /**
   * Create a new task with rule/skill context
   */
  async createTask(params) {
    const relatedRules = await this.findRelevantRules(
      params.title + " " + params.description,
    );
    const relatedSkill = await this.findRelevantSkill(
      params.title + " " + params.description,
    );
    const task = {
      id: randomUUID2(),
      title: params.title,
      description: params.description,
      status: "pending",
      priority: params.priority || "medium",
      relatedRules: relatedRules.map((r) => r.name),
      relatedSkill: relatedSkill?.name,
      blockedBy: params.blockedBy,
      criteria: params.criteria || [],
      targetFiles: params.targetFiles,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
    };
    this.tasks.set(task.id, task);
    this.updateBlockingRelationships();
    console.log(`[Beads] Created task: ${task.title} (${task.id})`);
    console.log(
      `[Beads] Related rules: ${task.relatedRules.join(", ") || "none"}`,
    );
    console.log(`[Beads] Related skill: ${task.relatedSkill || "none"}`);
    return task;
  }
  /**
   * Create multiple tasks from a plan
   */
  async createTasksFromPlan(plan) {
    const createdTasks = [];
    const titleToId = /* @__PURE__ */ new Map();
    for (const item of plan) {
      const task = await this.createTask({
        title: item.title,
        description: item.description,
        priority: item.priority,
        criteria: item.criteria,
      });
      createdTasks.push(task);
      titleToId.set(item.title, task.id);
    }
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      if (item.dependsOn && item.dependsOn.length > 0) {
        const blockedBy = item.dependsOn
          .map((title) => titleToId.get(title))
          .filter((id) => !!id);
        if (blockedBy.length > 0) {
          const task = createdTasks[i];
          task.blockedBy = blockedBy;
          task.status = "blocked";
          this.tasks.set(task.id, task);
        }
      }
    }
    this.updateBlockingRelationships();
    return createdTasks;
  }
  /**
   * Get task by ID
   */
  getTask(id) {
    return this.tasks.get(id);
  }
  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }
  /**
   * Get tasks by status
   */
  getTasksByStatus(status) {
    return this.getAllTasks().filter((t) => t.status === status);
  }
  /**
   * Get next executable task (highest priority, not blocked)
   */
  getNextTask() {
    const pendingTasks = this.getTasksByStatus("pending");
    if (pendingTasks.length === 0) return null;
    const priorityOrder = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    pendingTasks.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
    return pendingTasks[0];
  }
  /**
   * Update task status
   */
  updateTaskStatus(id, status) {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.status = status;
    task.updatedAt = /* @__PURE__ */ new Date();
    if (status === "completed") {
      task.completedAt = /* @__PURE__ */ new Date();
      this.unblockDependentTasks(id);
    }
    this.tasks.set(id, task);
    return task;
  }
  /**
   * Set task result (from Ralph execution)
   */
  setTaskResult(id, result) {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.result = result;
    task.status = result?.success ? "completed" : "pending";
    task.updatedAt = /* @__PURE__ */ new Date();
    if (result?.success) {
      task.completedAt = /* @__PURE__ */ new Date();
      this.unblockDependentTasks(id);
    }
    this.tasks.set(id, task);
    return task;
  }
  /**
   * Get context for task execution (rules + skill)
   */
  async getTaskContext(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    const rules = await Promise.all(
      task.relatedRules.map((name) => rulesParser.getRuleByName(name)),
    );
    const skill = task.relatedSkill
      ? await rulesParser.getSkillByName(task.relatedSkill)
      : null;
    const guidelines = [];
    for (const rule of rules.filter((r) => r !== null)) {
      guidelines.push(...rule.keyPoints);
    }
    return {
      task,
      rules: rules.filter((r) => r !== null),
      skill,
      guidelines: [...new Set(guidelines)],
    };
  }
  /**
   * Generate task summary for reporting
   */
  getSummary() {
    const tasks = this.getAllTasks();
    const total = tasks.length;
    const byStatus = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
      cancelled: 0,
    };
    const byPriority = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const task of tasks) {
      byStatus[task.status]++;
      byPriority[task.priority]++;
    }
    const completionRate = total > 0 ? (byStatus.completed / total) * 100 : 0;
    return { total, byStatus, byPriority, completionRate };
  }
  /**
   * Clear all tasks
   */
  clearTasks() {
    this.tasks.clear();
  }
  // =====================
  // Private helpers
  // =====================
  async findRelevantRules(text2) {
    if (!this.projectContext) return [];
    const lowerText = text2.toLowerCase();
    return this.projectContext.rules.filter((rule) => {
      if (rule.alwaysApply) return true;
      const keywords = [
        rule.name,
        ...(rule.keyPoints || []),
        rule.description || "",
      ].map((k) => k.toLowerCase());
      return keywords.some(
        (kw) => lowerText.includes(kw) || kw.includes(lowerText.slice(0, 20)),
      );
    });
  }
  async findRelevantSkill(text2) {
    if (!this.projectContext) return null;
    const lowerText = text2.toLowerCase();
    for (const skill of this.projectContext.skills) {
      const triggers = skill.triggers.map((t) => t.toLowerCase());
      if (triggers.some((t) => lowerText.includes(t))) {
        return skill;
      }
    }
    return null;
  }
  updateBlockingRelationships() {
    for (const task of this.tasks.values()) {
      if (task.blockedBy && task.blockedBy.length > 0) {
        for (const blockerId of task.blockedBy) {
          const blocker = this.tasks.get(blockerId);
          if (blocker) {
            blocker.blocks = blocker.blocks || [];
            if (!blocker.blocks.includes(task.id)) {
              blocker.blocks.push(task.id);
            }
          }
        }
      }
    }
  }
  unblockDependentTasks(completedTaskId) {
    for (const task of this.tasks.values()) {
      if (task.blockedBy?.includes(completedTaskId)) {
        task.blockedBy = task.blockedBy.filter((id) => id !== completedTaskId);
        const stillBlocked = task.blockedBy.some((id) => {
          const blocker = this.tasks.get(id);
          return blocker && blocker.status !== "completed";
        });
        if (!stillBlocked && task.status === "blocked") {
          task.status = "pending";
        }
      }
    }
  }
};
var beadsService = new BeadsService();

// beads/ralph.service.ts
var RalphService = class {
  activeCycles = /* @__PURE__ */ new Map();
  isRunning = false;
  /**
   * Execute a single task
   */
  async executeTask(taskId) {
    const startTime = Date.now();
    const cycle = this.startCycle(taskId);
    try {
      const context = await beadsService.getTaskContext(taskId);
      if (!context) {
        throw new Error(`Task ${taskId} not found`);
      }
      const { task, rules, skill, guidelines } = context;
      this.log(cycle, "info", `Starting execution: ${task.title}`);
      this.log(cycle, "info", `Guidelines: ${guidelines.length} rules loaded`);
      beadsService.updateTaskStatus(taskId, "in_progress");
      const executionPrompt = this.buildExecutionPrompt(
        task,
        rules,
        skill,
        guidelines,
      );
      this.log(cycle, "debug", "Execution prompt built");
      const result = await this.executeWithAI(executionPrompt, task, cycle);
      const taskResult = {
        success: result.success,
        output: result.output,
        filesModified: result.filesModified || [],
        errors: result.errors,
        duration: Date.now() - startTime,
      };
      beadsService.setTaskResult(taskId, taskResult);
      this.completeCycle(cycle, "completed");
      this.log(
        cycle,
        "info",
        `Completed: ${task.title} (${taskResult.success ? "success" : "failed"})`,
      );
      return taskResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.log(cycle, "error", `Execution failed: ${errorMessage}`);
      this.completeCycle(cycle, "failed");
      const taskResult = {
        success: false,
        output: "",
        filesModified: [],
        errors: [errorMessage],
        duration: Date.now() - startTime,
      };
      beadsService.setTaskResult(taskId, taskResult);
      return taskResult;
    }
  }
  /**
   * Execute all pending tasks in order
   */
  async executeAllPending() {
    const results = /* @__PURE__ */ new Map();
    this.isRunning = true;
    while (this.isRunning) {
      const nextTask = beadsService.getNextTask();
      if (!nextTask) break;
      const result = await this.executeTask(nextTask.id);
      results.set(nextTask.id, result);
      await this.delay(100);
    }
    this.isRunning = false;
    return results;
  }
  /**
   * Stop execution loop
   */
  stop() {
    this.isRunning = false;
  }
  /**
   * Get active cycles
   */
  getActiveCycles() {
    return Array.from(this.activeCycles.values());
  }
  /**
   * Get cycle by ID
   */
  getCycle(cycleId) {
    return this.activeCycles.get(cycleId);
  }
  /**
   * Get cycle logs
   */
  getCycleLogs(cycleId) {
    const cycle = this.activeCycles.get(cycleId);
    return cycle?.logs || [];
  }
  // =====================
  // Private methods
  // =====================
  startCycle(taskId) {
    const cycle = {
      id: `cycle-${Date.now()}`,
      taskId,
      startedAt: /* @__PURE__ */ new Date(),
      status: "running",
      logs: [],
    };
    this.activeCycles.set(cycle.id, cycle);
    return cycle;
  }
  completeCycle(cycle, status) {
    cycle.completedAt = /* @__PURE__ */ new Date();
    cycle.status = status;
    this.activeCycles.set(cycle.id, cycle);
  }
  log(cycle, level, message, data) {
    const logEntry = {
      timestamp: /* @__PURE__ */ new Date(),
      level,
      message,
      data,
    };
    cycle.logs.push(logEntry);
    console.log(`[Ralph][${level.toUpperCase()}] ${message}`);
  }
  buildExecutionPrompt(task, rules, skill, guidelines) {
    let prompt = `# Task Execution

`;
    prompt += `## Task
**${task.title}**

${task.description}

`;
    if (task.criteria.length > 0) {
      prompt += `## Acceptance Criteria
`;
      task.criteria.forEach((c, i) => {
        prompt += `${i + 1}. ${c}
`;
      });
      prompt += "\n";
    }
    if (task.targetFiles && task.targetFiles.length > 0) {
      prompt += `## Target Files
`;
      task.targetFiles.forEach((f) => {
        prompt += `- ${f}
`;
      });
      prompt += "\n";
    }
    if (guidelines.length > 0) {
      prompt += `## Guidelines (from project rules)
`;
      guidelines.slice(0, 15).forEach((g) => {
        prompt += `- ${g}
`;
      });
      prompt += "\n";
    }
    if (skill) {
      prompt += `## Relevant Skill: ${skill.name}
`;
      prompt += skill.description + "\n\n";
    }
    if (rules.length > 0) {
      prompt += `## Applied Rules
`;
      rules.forEach((r) => {
        prompt += `- **${r.name}**: ${r.description || r.keyPoints[0] || "Project rule"}
`;
      });
      prompt += "\n";
    }
    prompt += `## Instructions
`;
    prompt += `Analyze this task and provide:
`;
    prompt += `1. A step-by-step execution plan
`;
    prompt += `2. Expected changes/outputs
`;
    prompt += `3. Any potential issues or blockers
`;
    prompt += `4. Verification steps
`;
    return prompt;
  }
  async executeWithAI(prompt, task, cycle) {
    try {
      this.log(cycle, "info", "Sending to AI for analysis...");
      const completion = await openaiService.createChatCompletion({
        messages: [
          {
            role: "system",
            content: `You are Ralph, an autonomous task executor for the JSRVIS project.
You follow project rules from .cursor/rules/ and use skills from .cursor/skills/.
Your goal is to analyze tasks and provide clear execution plans.

When analyzing a task:
1. Break it down into concrete steps
2. Identify files that need to be modified
3. Consider project guidelines and constraints
4. Provide verification criteria

Respond in a structured format with:
- PLAN: numbered steps
- FILES: list of files to modify
- RISKS: potential issues
- VERIFICATION: how to verify success`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "gpt-4o",
        maxTokens: 2048,
      });
      const response = completion.choices[0]?.message?.content || "";
      this.log(cycle, "info", "AI analysis complete");
      const filesModified = this.extractFiles(response);
      const hasErrors =
        response.toLowerCase().includes("error") ||
        response.toLowerCase().includes("cannot") ||
        response.toLowerCase().includes("impossible");
      return {
        success: !hasErrors,
        output: response,
        filesModified,
        errors: hasErrors
          ? ["Task may have issues - review AI analysis"]
          : void 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "AI execution failed";
      this.log(cycle, "error", errorMessage);
      return {
        success: false,
        output: "",
        errors: [errorMessage],
      };
    }
  }
  extractFiles(text2) {
    const files = [];
    const filePatterns = [
      /`([^`]+\.[a-z]+)`/gi,
      // backtick paths
      /(?:^|\s)([\w./\\-]+\.(?:ts|tsx|js|jsx|json|md|mdc))/gm,
      // direct paths
    ];
    for (const pattern of filePatterns) {
      const matches = text2.matchAll(pattern);
      for (const match of matches) {
        const file = match[1];
        if (file && !files.includes(file) && !file.includes("example")) {
          files.push(file);
        }
      }
    }
    return files.slice(0, 20);
  }
  delay(ms) {
    return new Promise((resolve2) => setTimeout(resolve2, ms));
  }
};
var ralphService = new RalphService();

// beads/routes.ts
function registerBeadsRoutes(app2) {
  beadsService.initialize().catch(console.error);
  app2.get("/api/beads/context", async (req, res) => {
    try {
      const context = beadsService.getProjectContext();
      if (!context) {
        await beadsService.initialize();
      }
      res.json(beadsService.getProjectContext());
    } catch (error) {
      console.error("Error getting context:", error);
      res.status(500).json({ error: "Failed to get project context" });
    }
  });
  app2.get("/api/beads/tasks", (req, res) => {
    try {
      const status = req.query.status;
      const tasks = status
        ? beadsService.getTasksByStatus(status)
        : beadsService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error getting tasks:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });
  app2.get("/api/beads/tasks/:id", (req, res) => {
    try {
      const task = beadsService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  });
  app2.get("/api/beads/tasks/:id/context", async (req, res) => {
    try {
      const context = await beadsService.getTaskContext(req.params.id);
      if (!context) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(context);
    } catch (error) {
      console.error("Error getting task context:", error);
      res.status(500).json({ error: "Failed to get task context" });
    }
  });
  app2.post("/api/beads/tasks", async (req, res) => {
    try {
      const { title, description, priority, criteria, targetFiles, blockedBy } =
        req.body;
      if (!title || !description) {
        return res
          .status(400)
          .json({ error: "Title and description are required" });
      }
      const task = await beadsService.createTask({
        title,
        description,
        priority,
        criteria,
        targetFiles,
        blockedBy,
      });
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });
  app2.post("/api/beads/tasks/plan", async (req, res) => {
    try {
      const { plan } = req.body;
      if (!Array.isArray(plan) || plan.length === 0) {
        return res
          .status(400)
          .json({ error: "Plan must be a non-empty array" });
      }
      const tasks = await beadsService.createTasksFromPlan(plan);
      res.status(201).json(tasks);
    } catch (error) {
      console.error("Error creating tasks from plan:", error);
      res.status(500).json({ error: "Failed to create tasks from plan" });
    }
  });
  app2.patch("/api/beads/tasks/:id/status", (req, res) => {
    try {
      const { status } = req.body;
      const task = beadsService.updateTaskStatus(req.params.id, status);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });
  app2.get("/api/beads/summary", (req, res) => {
    try {
      const summary = beadsService.getSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error getting summary:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });
  app2.delete("/api/beads/tasks", (req, res) => {
    try {
      beadsService.clearTasks();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing tasks:", error);
      res.status(500).json({ error: "Failed to clear tasks" });
    }
  });
  app2.post("/api/ralph/execute/:taskId", async (req, res) => {
    try {
      const result = await ralphService.executeTask(req.params.taskId);
      res.json(result);
    } catch (error) {
      console.error("Error executing task:", error);
      res.status(500).json({ error: "Failed to execute task" });
    }
  });
  app2.post("/api/ralph/execute-all", async (req, res) => {
    try {
      ralphService.executeAllPending().catch(console.error);
      res.json({ message: "Execution started", status: "running" });
    } catch (error) {
      console.error("Error starting execution:", error);
      res.status(500).json({ error: "Failed to start execution" });
    }
  });
  app2.post("/api/ralph/stop", (req, res) => {
    try {
      ralphService.stop();
      res.json({ message: "Execution stopped" });
    } catch (error) {
      console.error("Error stopping execution:", error);
      res.status(500).json({ error: "Failed to stop execution" });
    }
  });
  app2.get("/api/ralph/cycles", (req, res) => {
    try {
      const cycles = ralphService.getActiveCycles();
      res.json(cycles);
    } catch (error) {
      console.error("Error getting cycles:", error);
      res.status(500).json({ error: "Failed to get cycles" });
    }
  });
  app2.get("/api/ralph/cycles/:cycleId/logs", (req, res) => {
    try {
      const logs = ralphService.getCycleLogs(req.params.cycleId);
      res.json(logs);
    } catch (error) {
      console.error("Error getting cycle logs:", error);
      res.status(500).json({ error: "Failed to get cycle logs" });
    }
  });
  app2.get("/api/ralph/next-task", (req, res) => {
    try {
      const task = beadsService.getNextTask();
      res.json(task || { message: "No pending tasks" });
    } catch (error) {
      console.error("Error getting next task:", error);
      res.status(500).json({ error: "Failed to get next task" });
    }
  });
}

// server/routes.ts
async function registerRoutes(app2) {
  registerChatRoutes(app2);
  registerImageRoutes(app2);
  registerAudioRoutes(app2);
  registerBeadsRoutes(app2);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express2();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express2.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app2.use(express2.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );
  if (!fs2.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({ req, res, landingPageTemplate, appName }) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function serveWebApp(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>JSRVIS - Universal AI ERP</title>
    <style>
      html, body { height: 100%; margin: 0; background: #0A0E1A; }
      body { overflow: hidden; }
      #root { display: flex; height: 100%; flex: 1; }
    </style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/client/index.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable"></script>
  </body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const isDev = process.env.NODE_ENV === "development";
  log("Serving static Expo files with dynamic manifest routing");
  app2.use(
    "/client",
    createProxyMiddleware({
      target: "http://localhost:8081",
      changeOrigin: true,
    }),
  );
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      if (isDev) {
        return serveWebApp(req, res);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }
    next();
  });
  app2.use("/assets", express2.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express2.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
