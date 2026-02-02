import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import {
  RagConfig,
  SearchResult,
  QdrantSearchResult,
  DocumentMetadata,
  RagProviderType,
  RagSettingsRequest,
} from "./rag.types";
import { randomUUID } from "crypto";
import { AppLogger } from "../../utils/logger";
import { EphemeralClientPoolService } from "../../services/ephemeral-client-pool.service";

@Injectable()
export class RagService {
  // Stateless: no in-memory storage
  // Documents are stored in user's RAG provider (Qdrant/Supabase)
  // OpenAI client is created per-request via EphemeralClientPoolService

  constructor(
    private configService: ConfigService,
    private ephemeralClientPool: EphemeralClientPoolService,
  ) {}

  getProviders(): { id: RagProviderType; name: string; configured: boolean }[] {
    // Stateless: providers are configured per-request
    return [
      {
        id: "qdrant",
        name: "Qdrant",
        configured: false, // Checked per-request from ragSettings
      },
      {
        id: "supabase",
        name: "Supabase",
        configured: false, // Checked per-request from ragSettings
      },
      {
        id: "replit",
        name: "Replit PostgreSQL",
        configured: false, // Disabled in stateless mode
      },
      {
        id: "none",
        name: "Disabled",
        configured: true,
      },
    ];
  }

  getCurrentProvider(): RagProviderType {
    // Stateless: no global provider
    return "none";
  }

  setProvider(settings: RagSettingsRequest): void {
    // Stateless: settings are passed per-request, not stored
    // This method is kept for API compatibility but does nothing
  }

  isAvailable(ragSettings?: RagSettingsRequest): boolean {
    if (!ragSettings || ragSettings.provider === "none") return false;
    if (ragSettings.provider === "replit") return false; // Disabled
    if (ragSettings.provider === "qdrant")
      return Boolean(ragSettings.qdrant?.url);
    if (ragSettings.provider === "supabase")
      return Boolean(ragSettings.supabase?.url);
    return false;
  }

  // Stateless: documents are stored in user's RAG provider
  async listDocuments(): Promise<DocumentMetadata[]> {
    // Stateless: return empty array
    // Client should query RAG provider directly if needed
    return [];
  }

  async getDocument(id: string): Promise<DocumentMetadata | null> {
    // Stateless: return null
    // Client should query RAG provider directly if needed
    return null;
  }

  async getDocumentContent(id: string): Promise<string | null> {
    // Stateless: return null
    // Client should query RAG provider directly if needed
    return null;
  }

  async uploadDocument(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    ragSettings?: RagSettingsRequest,
  ): Promise<DocumentMetadata> {
    // Stateless: process and upload directly to provider, no local storage
    const id = randomUUID();
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "other";
    const fileType: DocumentMetadata["type"] =
      fileExtension === "pdf"
        ? "pdf"
        : fileExtension === "txt"
          ? "txt"
          : fileExtension === "docx"
            ? "docx"
            : fileExtension === "xlsx"
              ? "xlsx"
              : "other";

    const doc: DocumentMetadata = {
      id,
      name: fileName,
      type: fileType,
      size: this.formatFileSize(buffer.length),
      uploadedAt: new Date(),
      status: "processing",
    };

    // Process and upload to provider asynchronously
    this.processDocument(id, buffer, mimeType, ragSettings).catch((error) => {
      AppLogger.error(`Failed to process document ${id}:`, error);
    });

    return doc;
  }

  async uploadFromUrl(
    url: string,
    name: string,
    ragSettings?: RagSettingsRequest,
  ): Promise<DocumentMetadata> {
    // Stateless: process and upload directly to provider
    const id = randomUUID();
    const fileExtension = name.split(".").pop()?.toLowerCase() || "other";
    const fileType: DocumentMetadata["type"] =
      fileExtension === "pdf"
        ? "pdf"
        : fileExtension === "txt"
          ? "txt"
          : fileExtension === "docx"
            ? "docx"
            : fileExtension === "xlsx"
              ? "xlsx"
              : "other";

    const doc: DocumentMetadata = {
      id,
      name,
      type: fileType,
      size: "Unknown",
      uploadedAt: new Date(),
      status: "processing",
    };

    // Process and upload to provider asynchronously
    this.processDocumentFromUrl(id, url, ragSettings).catch((error) => {
      AppLogger.error(`Failed to process document from URL ${id}:`, error);
    });

    return doc;
  }

  async deleteDocument(
    id: string,
    ragSettings?: RagSettingsRequest,
  ): Promise<boolean> {
    // Stateless: delete from provider only
    if (!ragSettings || !this.isAvailable(ragSettings)) {
      return false;
    }

    try {
      await this.deleteFromProvider(id, ragSettings);
      return true;
    } catch (error) {
      AppLogger.error("Error deleting from provider:", error);
      return false;
    }
  }

  async reindexDocument(
    id: string,
    ragSettings?: RagSettingsRequest,
  ): Promise<DocumentMetadata | null> {
    // Stateless: reindexing requires content, which we don't store
    // Client should re-upload document if reindexing is needed
    AppLogger.warn(
      "Reindexing not supported in stateless mode. Please re-upload the document.",
    );
    return null;
  }

  private async processDocument(
    id: string,
    buffer: Buffer,
    mimeType: string,
    ragSettings?: RagSettingsRequest,
  ) {
    try {
      let content: string;

      if (mimeType === "text/plain" || mimeType.includes("text")) {
        content = buffer.toString("utf-8");
      } else if (mimeType === "application/pdf") {
        try {
          let parser: PDFParse | null = null;
          try {
            parser = new PDFParse({ data: buffer });
            const pdfData = await parser.getText();
            content = pdfData.text || "";
          } finally {
            if (parser) {
              await parser.destroy();
            }
          }
          if (!content.trim()) {
            content =
              "[PDF contains no extractable text - may be scanned/image-based]";
          }
          AppLogger.info(
            `PDF parsed successfully: ${content.length} characters extracted`,
          );
        } catch (pdfError) {
          AppLogger.error("PDF parsing error:", pdfError);
          content = `[PDF parsing failed: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}]`;
        }
      } else {
        content = `[Document content - format: ${mimeType}]`;
      }

      // Stateless: index directly to provider, no local storage
      await this.indexDocument(id, content, ragSettings);
    } catch (error) {
      AppLogger.error("Error processing document:", error);
    }
  }

  private async processDocumentFromUrl(
    id: string,
    url: string,
    ragSettings?: RagSettingsRequest,
  ) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "text/plain";

      // Stateless: process and index directly to provider
      await this.processDocument(id, buffer, contentType, ragSettings);
    } catch (error) {
      AppLogger.error("Error processing document from URL:", error);
    }
  }

  private async indexDocument(
    id: string,
    content: string,
    ragSettings?: RagSettingsRequest,
  ) {
    if (!ragSettings || !this.isAvailable(ragSettings)) {
      return;
    }

    try {
      const chunks = this.splitIntoChunks(content, 500);
      const doc: DocumentMetadata = {
        id,
        name: `Document ${id}`,
        type: "txt",
        size: this.formatFileSize(content.length),
        uploadedAt: new Date(),
        status: "indexed",
        chunkCount: chunks.length,
      };

      // Extract LLM settings for embeddings
      const llmSettings = {
        apiKey: this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
        baseUrl: this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL"),
        provider: "openai",
      };

      switch (ragSettings.provider) {
        case "qdrant":
          await this.indexToQdrant(
            id,
            chunks,
            doc,
            ragSettings.qdrant,
            llmSettings,
          );
          break;
        case "supabase":
          await this.indexToSupabase(
            id,
            chunks,
            doc,
            ragSettings.supabase,
            llmSettings,
          );
          break;
        case "replit":
          // Disabled in stateless mode
          break;
      }
    } catch (error) {
      AppLogger.error("Error indexing document:", error);
      throw error;
    }
  }

  private async indexToQdrant(
    id: string,
    chunks: string[],
    doc: DocumentMetadata,
    config?: RagConfig,
    llmSettings?: { apiKey?: string; baseUrl?: string; provider?: string },
  ) {
    if (!config?.url) return;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embed(chunks[i], llmSettings);
      await fetch(`${config.url}/collections/${config.collectionName}/points`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey && { "api-key": config.apiKey }),
        },
        body: JSON.stringify({
          points: [
            {
              id: `${id}-${i}`,
              vector: embedding,
              payload: {
                content: chunks[i],
                documentId: id,
                documentName: doc?.name,
                chunkIndex: i,
              },
            },
          ],
        }),
      });
    }
  }

  private async indexToSupabase(
    id: string,
    chunks: string[],
    doc: DocumentMetadata,
    config?: { url: string; apiKey?: string; tableName: string },
    llmSettings?: { apiKey?: string; baseUrl?: string; provider?: string },
  ) {
    if (!config?.url) return;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embed(chunks[i], llmSettings);
      await fetch(`${config.url}/rest/v1/${config.tableName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey || "",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          document_id: id,
          content: chunks[i],
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({ documentName: doc?.name, chunkIndex: i }),
        }),
      });
    }
  }

  private async deleteFromProvider(
    documentId: string,
    ragSettings: RagSettingsRequest,
  ) {
    switch (ragSettings.provider) {
      case "qdrant":
        await this.deleteFromQdrant(documentId, ragSettings.qdrant);
        break;
      case "supabase":
        await this.deleteFromSupabase(documentId, ragSettings.supabase);
        break;
      case "replit":
        // Disabled in stateless mode
        break;
    }
  }

  private async deleteFromQdrant(documentId: string, config?: RagConfig) {
    if (!config?.url) return;

    await fetch(
      `${config.url}/collections/${config.collectionName}/points/delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey && { "api-key": config.apiKey }),
        },
        body: JSON.stringify({
          filter: {
            must: [{ key: "documentId", match: { value: documentId } }],
          },
        }),
      },
    );
  }

  private async deleteFromSupabase(
    documentId: string,
    config?: { url: string; apiKey?: string; tableName: string },
  ) {
    if (!config?.url) return;

    await fetch(
      `${config.url}/rest/v1/${config.tableName}?document_id=eq.${documentId}`,
      {
        method: "DELETE",
        headers: {
          apikey: config.apiKey || "",
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    );
  }

  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async embed(
    text: string,
    llmSettings?: { apiKey?: string; baseUrl?: string; provider?: string },
  ): Promise<number[]> {
    // Use ephemeral client pool for OpenAI embeddings
    const llmKey =
      llmSettings?.apiKey ||
      this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY") ||
      "";
    const llmBaseUrl =
      llmSettings?.baseUrl ||
      this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL");

    if (!llmKey) {
      throw new Error("OpenAI API key is required for embeddings");
    }

    return await this.ephemeralClientPool.useClient(
      {
        llmKey,
        llmProvider: (llmSettings?.provider as string) || "openai",
        llmBaseUrl,
      },
      async (client: OpenAI) => {
        const response = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });
        return response.data[0].embedding;
      },
    );
  }

  async search(
    query: string,
    limit = 3,
    ragSettings?: RagSettingsRequest,
  ): Promise<SearchResult[]> {
    if (!ragSettings || !this.isAvailable(ragSettings)) {
      return [];
    }

    try {
      // Extract LLM settings from request if available
      // Note: RagSettingsRequest doesn't include llmSettings, so we use defaults
      const llmSettings = {
        apiKey: this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
        baseUrl: this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL"),
        provider: "openai",
      };

      switch (ragSettings.provider) {
        case "qdrant":
          return await this.searchQdrant(
            query,
            limit,
            ragSettings.qdrant,
            llmSettings,
          );
        case "supabase":
          return await this.searchSupabase(
            query,
            limit,
            ragSettings.supabase,
            llmSettings,
          );
        case "replit":
          // Disabled in stateless mode
          return [];
        default:
          return [];
      }
    } catch (error) {
      AppLogger.error("Error searching:", error);
      return [];
    }
  }

  private async searchQdrant(
    query: string,
    limit: number,
    config?: RagConfig,
    llmSettings?: { apiKey?: string; baseUrl?: string; provider?: string },
  ): Promise<SearchResult[]> {
    if (!config?.url) return [];

    const embedding = await this.embed(query, llmSettings);
    const response = await fetch(
      `${config.url}/collections/${config.collectionName}/points/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey && { "api-key": config.apiKey }),
        },
        body: JSON.stringify({ vector: embedding, limit, with_payload: true }),
      },
    );

    if (!response.ok) throw new Error(`Qdrant error: ${response.status}`);

    const data = await response.json();
    const results: QdrantSearchResult[] = data.result || [];

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      content: r.payload.content,
      metadata: { title: r.payload.title, source: "qdrant" },
    }));
  }

  private async searchSupabase(
    query: string,
    limit: number,
    config?: { url: string; apiKey?: string; tableName: string },
    llmSettings?: { apiKey?: string; baseUrl?: string; provider?: string },
  ): Promise<SearchResult[]> {
    if (!config?.url) return [];

    const embedding = await this.embed(query, llmSettings);
    const response = await fetch(`${config.url}/rest/v1/rpc/match_documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey || "",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: limit,
      }),
    });

    if (!response.ok) return [];

    const results = await response.json();
    return results.map(
      (r: { id: string; content: string; similarity: number }) => ({
        id: r.id,
        score: r.similarity,
        content: r.content,
        metadata: { source: "supabase" },
      }),
    );
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Stateless: no local results storage
  private getLocalResults(_query: string, _limit: number): SearchResult[] {
    // Return empty array - client should use RAG provider
    return [];
  }

  buildContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const contextParts = results.map((r, i) => {
      const title = r.metadata?.title
        ? `[${r.metadata.title}]`
        : `[Документ ${i + 1}]`;
      return `${title}\n${r.content}`;
    });

    return `Релевантная информация из базы знаний:\n\n${contextParts.join("\n\n---\n\n")}`;
  }

  // Stateless: seedDemoData requires ragSettings to upload to provider
  async seedDemoData(ragSettings?: RagSettingsRequest): Promise<{
    created: number;
    documents: DocumentMetadata[];
  }> {
    if (!ragSettings || !this.isAvailable(ragSettings)) {
      return { created: 0, documents: [] };
    }

    const demoDocuments = [
      {
        name: "Company Overview",
        content: `AXON Corporation - Company Overview

Founded in 2020, AXON is a leading provider of AI-powered enterprise solutions. Our flagship product, AXON ERP OS, revolutionizes how businesses interact with their enterprise systems.

Key Products:
- AXON ERP OS: Universal AI interface for ERP systems
- AXON Voice: Natural language processing for business commands
- AXON Vision: Document scanning and OCR capabilities

Company Statistics:
- Employees: 150+
- Revenue (2024): $25M
- Customers: 500+ enterprises worldwide
- Supported ERP systems: SAP, Odoo, Oracle, Microsoft Dynamics`,
      },
      {
        name: "Product Catalog",
        content: `AXON Product Catalog 2025

1. Coffee Beans Premium Blend
   SKU: CB-001
   Price: $24.99/kg
   Stock: 500 units
   Category: Beverages

2. Office Supplies Kit
   SKU: OS-102
   Price: $89.99
   Stock: 150 units
   Category: Office

3. Laptop Stand Pro
   SKU: LS-205
   Price: $149.99
   Stock: 75 units
   Category: Electronics

4. Wireless Mouse Ergonomic
   SKU: WM-301
   Price: $45.99
   Stock: 200 units
   Category: Electronics

5. Desk Organizer Set
   SKU: DO-401
   Price: $35.99
   Stock: 300 units
   Category: Office`,
      },
      {
        name: "Financial Report Q4 2024",
        content: `Quarterly Financial Report - Q4 2024

Revenue Summary:
- Total Revenue: $6.2M
- YoY Growth: 35%
- Gross Margin: 72%

Revenue by Region:
- North America: $2.8M (45%)
- Europe: $1.9M (31%)
- Asia Pacific: $1.1M (18%)
- Other: $0.4M (6%)

Key Metrics:
- Customer Acquisition Cost: $2,500
- Lifetime Value: $45,000
- Churn Rate: 2.3%
- Net Promoter Score: 72

Expenses:
- R&D: $1.8M
- Sales & Marketing: $1.2M
- Operations: $0.9M
- G&A: $0.6M`,
      },
      {
        name: "Employee Handbook",
        content: `AXON Employee Handbook 2025

Working Hours:
- Core hours: 10:00 AM - 4:00 PM
- Flexible scheduling available
- Remote work: Up to 3 days per week

Benefits:
- Health Insurance: 100% covered
- 401(k): 4% company match
- PTO: 25 days annually
- Parental Leave: 16 weeks paid

Professional Development:
- Annual learning budget: $2,500
- Conference attendance encouraged
- Internal mentorship program

Contact HR:
- Email: hr@axon.corp
- Phone: +1-555-AXON-HR
- Slack: #hr-support`,
      },
      {
        name: "Technical Documentation",
        content: `AXON ERP OS - Technical Integration Guide

Supported Protocols:
- REST API (JSON)
- OData 4.0
- GraphQL
- gRPC

Authentication Methods:
- OAuth 2.0
- API Key
- JWT Tokens
- SAML 2.0

Rate Limits:
- Standard: 1000 requests/minute
- Enterprise: 10000 requests/minute
- Bulk operations: 100 requests/minute

Webhook Events:
- order.created
- inventory.updated
- payment.received
- document.processed

SDKs Available:
- JavaScript/TypeScript
- Python
- Java
- C#
- Go`,
      },
    ];

    const createdDocs: DocumentMetadata[] = [];

    for (const demo of demoDocuments) {
      // Stateless: upload directly to provider
      const doc = await this.uploadDocument(
        Buffer.from(demo.content, "utf-8"),
        demo.name,
        "text/plain",
        ragSettings,
      );
      createdDocs.push(doc);
    }

    return {
      created: createdDocs.length,
      documents: createdDocs,
    };
  }
}
