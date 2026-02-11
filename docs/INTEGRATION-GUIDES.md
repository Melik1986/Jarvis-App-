# Integration Guides

**Version:** 1.0.0  
**Last Updated:** 11 Feb 2025

---

## Table of Contents

1. [Adding a New LLM Provider](#adding-a-new-llm-provider)
2. [Adding a New ERP System](#adding-a-new-erp-system)
3. [Adding a New RAG Provider](#adding-a-new-rag-provider)
4. [Creating MCP Servers](#creating-mcp-servers)
5. [Custom Tool Development](#custom-tool-development)

---

## Adding a New LLM Provider

### Overview

AXON supports any LLM via the **Vercel AI SDK** or custom HTTP clients. This guide covers adding a new provider (e.g., Anthropic Claude, Gemini).

### Prerequisites

- LLM API key mechanism
- API documentation for chat completion
- Support for tool/function calling (recommended)
- Stream support for real-time responses

### Step 1: Create Provider Configuration

**File:** `server/src/modules/llm/providers/anthropic.provider.ts`

```typescript
import { LanguageModelV1 } from "@ai-sdk/provider";
import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicConfig {
  apiKey: string;
  model: string; // 'claude-3-opus', 'claude-3-sonnet', etc.
  maxTokens?: number;
  temperature?: number;
}

export class AnthropicProvider {
  private client: Anthropic;
  private config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  /**
   * Convert AXON tool format to Anthropic format
   */
  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    }));
  }

  /**
   * Stream messages with tool calling support
   */
  async streamChat(
    messages: { role: string; content: string }[],
    tools: ToolDefinition[],
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {},
  ): Promise<AsyncIterable<string>> {
    const stream = await this.client.messages.stream({
      model: this.config.model,
      max_tokens: options.maxTokens || this.config.maxTokens || 2048,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      system: "You are a helpful ERP assistant...",
      messages: messages as Anthropic.MessageParam[],
      tools: tools.length > 0 ? this.convertTools(tools) : undefined,
    });

    return this.createStreamIterable(stream);
  }

  private async *createStreamIterable(stream: any): AsyncIterable<string> {
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    }
  }

  /**
   * Parse tool calls from Anthropic response
   */
  parseToolCalls(response: Anthropic.Message): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
          id: block.id,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Model capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      toolCalling: true,
      vision: this.config.model.includes("vision"),
      maxContextWindow: 200000, // Claude 3 tokens
      costPerMTok: 0.015, // Pricing (USD per million tokens)
    };
  }
}
```

### Step 2: Register Provider in Factory

**File:** `server/src/modules/llm/llm.provider-factory.ts`

```typescript
import { AnthropicProvider } from "./providers/anthropic.provider";

export class LlmProviderFactory {
  static create(provider: string, config: any): LlmProvider {
    switch (provider.toLowerCase()) {
      case "openai":
        return new OpenAiProvider(config);
      case "groq":
        return new GroqProvider(config);
      case "anthropic": // NEW
        return new AnthropicProvider(config);
      case "ollama":
        return new OllamaProvider(config);
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  /**
   * List all available providers
   */
  static listProviders(): ProviderInfo[] {
    return [
      {
        id: "openai",
        name: "OpenAI",
        models: ["gpt-4o", "gpt-4o-mini"],
      },
      {
        id: "groq",
        name: "Groq",
        models: ["mixtral-8x7b"],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        models: ["claude-3-opus", "claude-3-sonnet"],
      },
      // ...
    ];
  }
}
```

### Step 3: Update Env Template

**File:** `.env.example`

```bash
# Add Anthropic config
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-3-sonnet
ANTHROPIC_MAX_TOKENS=2048
```

### Step 4: Add UI Option (Mobile)

**File:** `client/screens/settings/LLMProviderScreen.tsx`

```typescript
const LLM_PROVIDERS: LlmProviderOption[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    models: ['gpt-4o', 'gpt-4o-mini'],
    requiresApiKey: true,
  },
  {
    id: 'anthropic', // NEW
    name: 'Anthropic Claude',
    icon: '🧠',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    requiresApiKey: true,
    docUrl: 'https://console.anthropic.com',
  },
  // ...
];

export const LLMProviderScreen = () => {
  return (
    <ScrollView>
      {LLM_PROVIDERS.map(provider => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </ScrollView>
  );
};
```

### Step 5: Testing

```bash
# Add unit tests
touch server/src/modules/llm/providers/anthropic.provider.test.ts
```

```typescript
// anthropic.provider.test.ts
describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: "test-key",
      model: "claude-3-sonnet",
    });
  });

  it("should convert tools to Anthropic format", () => {
    const tools = [
      {
        name: "get_stock",
        description: "Get product stock",
        parameters: {
          properties: { productId: { type: "string" } },
          required: ["productId"],
        },
      },
    ];

    const converted = provider["convertTools"](tools);
    expect(converted[0].name).toBe("get_stock");
  });

  it("should stream chat responses", async () => {
    const stream = await provider.streamChat(
      [{ role: "user", content: "Hello" }],
      [],
    );

    let text = "";
    for await (const chunk of stream) {
      text += chunk;
    }

    expect(text.length).toBeGreaterThan(0);
  });
});
```

---

## Adding a New ERP System

### Overview

AXON uses an **Adapter Pattern** for ERP integration. Each ERP has a dedicated adapter that:

1. Converts API schemas to AXON tool format
2. Authenticates with the ERP system
3. Implements CRUD operations

### Supported ERP Types

| Type      | Example        | Authentication    | Data Format |
| --------- | -------------- | ----------------- | ----------- |
| **OData** | SAP, Odoo      | API Key, OAuth    | JSON        |
| **REST**  | Custom APIs    | JWT, API Key      | JSON        |
| **RPC**   | Odoo XML-RPC   | Username/Password | XML         |
| **SOAP**  | Legacy systems | WS-Security       | XML         |

### Step 1: Create ERP Adapter

**File:** `server/src/modules/erp/adapters/netsuite.adapter.ts`

```typescript
import { ErpAdapter } from "../erp.interface";
import axios, { AxiosInstance } from "axios";

export interface NetSuiteConfig {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  environment: "sandbox" | "production";
}

export class NetSuiteAdapter implements ErpAdapter {
  private client: AxiosInstance;
  private config: NetSuiteConfig;

  constructor(config: NetSuiteConfig) {
    this.config = config;
    const baseUrl = `https://${
      config.environment === "sandbox" ? "sandbox." : ""
    }rest.netsuite.com/app/site/hosting/restlet.nl`;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
    });

    // Add OAuth signature middleware
    this.client.interceptors.request.use((req) => this.signRequest(req));
  }

  /**
   * Sign request with OAuth 1.0
   */
  private signRequest(req: any) {
    // Implement OAuth 1.0 signature
    // See: https://www.ietf.org/rfc/rfc5849.txt
    return req;
  }

  /**
   * Get documents (e.g., sales orders)
   */
  async getDocuments(filter: DocumentFilter): Promise<Document[]> {
    try {
      const response = await this.client.post("/document/query", {
        recordType: filter.type, // 'salesorder', 'invoice', etc.
        filters: {
          status: filter.status,
          dateRange: filter.dateRange,
        },
      });

      return response.data.records.map((record) =>
        this.mapNetSuiteToAxon(record),
      );
    } catch (error) {
      throw new ErpConnectionError("NetSuite query failed", error);
    }
  }

  /**
   * Create document
   */
  async createDocument(doc: Document): Promise<CreateResponse> {
    try {
      const netSuiteDoc = this.mapAxonToNetSuite(doc);
      const response = await this.client.post("/document/create", {
        record: netSuiteDoc,
      });

      return {
        id: response.data.id,
        url: `https://netsuite.com/app/core/records/sales.order/${response.data.id}`,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new ErpConnectionError("NetSuite create failed", error);
    }
  }

  /**
   * Map NetSuite format to AXON format
   */
  private mapNetSuiteToAxon(record: any): Document {
    return {
      id: record.internalId,
      type: record.recordType,
      number: record.tranId,
      date: new Date(record.createdDate),
      items: record.lineItems.map((item) => ({
        productId: item.item.id,
        productName: item.item.name,
        quantity: item.quantity,
        unitPrice: item.rate,
        total: item.amount,
      })),
      total: record.total,
      customer: {
        id: record.customer.id,
        name: record.customer.name,
      },
      status: record.status,
    };
  }

  /**
   * Map AXON format to NetSuite
   */
  private mapAxonToNetSuite(doc: Document): any {
    return {
      recordType: this.docTypeToNetSuite(doc.type),
      customer: doc.customer.id,
      lineItems: doc.items.map((item) => ({
        item: item.productId,
        quantity: item.quantity,
        rate: item.unitPrice,
      })),
      dueDate: doc.dueDate,
    };
  }

  /**
   * Generate AXON tools from NetSuite OpenAPI spec
   */
  async generateTools(): Promise<Tool[]> {
    // Fetch OpenAPI spec from NetSuite
    const spec = await this.fetchOpenApiSpec();

    // Generate tools
    return Object.entries(spec.paths).map(([path, methods]) =>
      this.createToolFromEndpoint(path, methods),
    );
  }

  /**
   * Get system capabilities
   */
  getCapabilities(): ErpCapabilities {
    return {
      supports: {
        read: true,
        create: true,
        update: true,
        delete: false, // NetSuite doesn't allow deletion via REST
      },
      documentTypes: ["salesorder", "invoice", "purchaseorder", "payment"],
      queryCapabilities: {
        filtering: true,
        sorting: true,
        pagination: true,
      },
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get("/health");
      return true;
    } catch {
      return false;
    }
  }
}
```

### Step 2: Register Adapter

**File:** `server/src/modules/erp/erp.adapter-factory.ts`

```typescript
import { NetSuiteAdapter } from "./adapters/netsuite.adapter";

export class ErpAdapterFactory {
  static create(provider: string, config: any): ErpAdapter {
    switch (provider.toLowerCase()) {
      case "1c":
        return new OdataAdapter(config);
      case "sap":
        return new SapAdapter(config);
      case "odoo":
        return new OdooAdapter(config);
      case "netsuite": // NEW
        return new NetSuiteAdapter(config);
      default:
        throw new Error(`Unknown ERP provider: ${provider}`);
    }
  }

  static listProviders(): ErpProviderInfo[] {
    return [
      {
        id: "1c",
        name: "1C:Enterprise",
        docTypes: ["invoice", "order", "stock"],
      },
      {
        id: "netsuite",
        name: "NetSuite",
        docTypes: ["salesorder", "invoice", "purchaseorder"],
      },
      // ...
    ];
  }
}
```

### Step 3: Add Authentication Controller

**File:** `server/src/modules/erp/controllers/netsuite-auth.controller.ts`

```typescript
import { Controller, Post, Body } from "@nestjs/common";

@Controller("erp/netsuite")
export class NetSuiteAuthController {
  /**
   * Verify NetSuite credentials
   */
  @Post("verify")
  async verifyCredentials(
    @Body() config: NetSuiteConfig,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const adapter = new NetSuiteAdapter(config);
      const isHealthy = await adapter.healthCheck();

      return { valid: isHealthy };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}
```

### Step 4: Mobile UI Integration

**File:** `client/screens/settings/ERPSettingsScreen.tsx`

```typescript
const ERP_PROVIDERS: ErpProviderOption[] = [
  {
    id: "netsuite",
    name: "NetSuite",
    icon: "📊",
    fields: [
      { name: "accountId", type: "text", label: "Account ID" },
      { name: "consumerKey", type: "text", label: "Consumer Key" },
      { name: "consumerSecret", type: "password", label: "Consumer Secret" },
      { name: "tokenId", type: "text", label: "Token ID" },
      { name: "tokenSecret", type: "password", label: "Token Secret" },
    ],
    testEndpoint: "/api/erp/netsuite/verify",
  },
];
```

### Step 5: Testing

```typescript
// netsuite.adapter.test.ts
describe("NetSuiteAdapter", () => {
  let adapter: NetSuiteAdapter;

  beforeEach(() => {
    adapter = new NetSuiteAdapter({
      accountId: "TEST123",
      // ... credentials
      environment: "sandbox",
    });
  });

  it("should fetch documents", async () => {
    const docs = await adapter.getDocuments({
      type: "invoice",
      status: "open",
    });

    expect(Array.isArray(docs)).toBe(true);
    expect(docs[0]).toHaveProperty("id");
  });

  it("should map NetSuite format to AXON", () => {
    const record = {
      internalId: "123",
      recordType: "invoice",
      tranId: "INV-001",
    };

    const mapped = adapter["mapNetSuiteToAxon"](record);
    expect(mapped.id).toBe("123");
  });
});
```

---

## Adding a New RAG Provider

### Overview

RAG providers handle document indexing and semantic search.

### Step 1: Create RAG Provider

**File:** `server/src/modules/rag/providers/pinecone.provider.ts`

```typescript
import { RagProvider } from "../rag.interface";
import { Pinecone } from "@pinecone-database/pinecone";

export class PineconeProvider implements RagProvider {
  private client: Pinecone;
  private indexName: string;

  constructor(apiKey: string, indexName: string) {
    this.client = new Pinecone({ apiKey });
    this.indexName = indexName;
  }

  /**
   * Index document chunks
   */
  async indexChunks(
    chunks: { id: string; text: string; metadata: any }[],
    embeddings: number[][],
  ): Promise<void> {
    const index = this.client.Index(this.indexName);

    const vectors = chunks.map((chunk, i) => ({
      id: chunk.id,
      values: embeddings[i],
      metadata: chunk.metadata,
    }));

    await index.upsert(vectors);
  }

  /**
   * Search similar chunks
   */
  async search(
    query: string,
    queryEmbedding: number[],
    topK: number = 5,
  ): Promise<SearchResult[]> {
    const index = this.client.Index(this.indexName);

    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return results.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const index = this.client.Index(this.indexName);
    await index.delete({
      filter: { documentId: documentId },
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const index = this.client.Index(this.indexName);
      await index.describeIndexStats();
      return true;
    } catch {
      return false;
    }
  }
}
```

### Step 2: Register Provider

```typescript
// rag.provider-factory.ts
export class RagProviderFactory {
  static create(provider: string, config: any): RagProvider {
    switch (provider.toLowerCase()) {
      case "qdrant":
        return new QdrantProvider(config);
      case "pinecone": // NEW
        return new PineconeProvider(config.apiKey, config.indexName);
      default:
        throw new Error(`Unknown RAG provider: ${provider}`);
    }
  }
}
```

---

## Creating MCP Servers

### Overview

MCP (Model Context Protocol) allows AXON to interact with external tools and data sources.

### Step 1: Create MCP Server

**File:** `mcp-servers/file-operations/index.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";

const server = new Server({
  name: "file-operations-mcp",
  version: "1.0.0",
});

/**
 * Define tools this MCP server provides
 */
const tools: Tool[] = [
  {
    name: "read_file",
    description: "Read contents of a file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "write_file",
    description: "Write contents to a file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string" },
        content: { type: "string" },
      },
      required: ["filePath", "content"],
    },
  },
];

// Register tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "read_file": {
      const content = await fs.readFile(args.filePath, "utf-8");
      return { content };
    }
    case "write_file": {
      await fs.writeFile(args.filePath, args.content);
      return { success: true };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

### Step 2: Deploy MCP Server

```bash
# Option 1: Run locally
npx tsx mcp-servers/file-operations/index.ts

# Option 2: Docker
docker run -e MCP_TOOLS=file-operations mcp-server:latest

# Option 3: Package as Node module
npm package mcp-file-operations
npm install mcp-file-operations
```

### Step 3: Connect to AXON

On mobile app → Settings → MCP Servers → Add Server:

```
Server URL: http://localhost:3001
Name: File Operations
Trust Level: Managed
```

---

## Custom Tool Development

### Creating a Custom Skill

**File:** `client/screens/skills/SkillEditorScreen.tsx`

```typescript
const customSkill = `
/**
 * Calculate shipping cost based on distance
 * @param {number} distance - Distance in km
 * @param {number} weight - Weight in kg
 * @returns {number} Shipping cost in USD
 */
module.exports = async (distance, weight) => {
  const baseCost = 5;
  const perKmCost = 0.5;
  const perKgCost = 2;
  
  const distanceCost = distance * perKmCost;
  const weightCost = weight * perKgCost;
  
  return baseCost + distanceCost + weightCost;
};
`;

// Save to skills table
await skillsStore.addSkill({
  name: "Calculate Shipping",
  type: "javascript",
  content: customSkill,
  tags: ["logistics", "pricing"],
});
```

### Testing Skills

```bash
# Test in sandbox
POST /api/skills/sandbox-execute

{
  "skillId": "skill_123",
  "arguments": [100, 50]
}

# Response
{
  "result": 160,
  "executionTime": 5,
  "error": null
}
```

---

## Best Practices

### When Adding a New Provider

1. ✅ **Error Handling:** Wrap all API calls with try-catch
2. ✅ **Logging:** Use structured logging for debugging
3. ✅ **Testing:** Write unit + integration tests
4. ✅ **Documentation:** Document config options & examples
5. ✅ **Security:** Never log sensitive data (use masking)
6. ✅ **Performance:** Cache metadata, use pagination
7. ✅ **Type Safety:** Use TypeScript interfaces

---

## Troubleshooting

### "Unknown provider" Error

- Ensure adapter is registered in factory
- Check spelling matches switch case

### Rate Limiting from ERP

- Implement exponential backoff
- Cache results locally
- Contact ERP provider for higher limits

### Vector Store Connection Failed

- Verify network connectivity
- Check API key validity
- Ensure index exists in vector store

---

## References

- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAPI 3.0 Spec](https://spec.openapis.org/)
- [MCP Protocol](https://modelcontextprotocol.io/)

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team
