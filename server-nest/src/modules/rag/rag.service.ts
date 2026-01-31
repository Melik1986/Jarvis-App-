import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  RagConfig,
  SearchResult,
  QdrantSearchResult,
  DocumentMetadata,
  RagProviderType,
  RagSettingsRequest,
} from "./rag.types";
import { randomUUID } from "crypto";
import { DATABASE_CONNECTION, Database } from "../../db/db.module";
import { sql } from "drizzle-orm";
import * as schema from "../../../../shared/schema";

export interface ProviderConfig {
  type: RagProviderType;
  qdrant?: RagConfig;
  supabase?: {
    url: string;
    apiKey?: string;
    tableName: string;
  };
  replit?: {
    tableName: string;
  };
}

@Injectable()
export class RagService {
  private providerConfig: ProviderConfig;
  private openai: OpenAI;
  private documents: Map<string, DocumentMetadata> = new Map();
  private documentContents: Map<string, string> = new Map();

  constructor(
    private configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private db: Database,
  ) {
    this.providerConfig = {
      type:
        (this.configService.get("RAG_PROVIDER") as RagProviderType) || "none",
      qdrant: {
        url: this.configService.get("QDRANT_URL") || "",
        apiKey: this.configService.get("QDRANT_API_KEY"),
        collectionName: "kb_jarvis",
      },
      supabase: {
        url: this.configService.get("SUPABASE_URL") || "",
        apiKey: this.configService.get("SUPABASE_ANON_KEY"),
        tableName: "documents",
      },
      replit: {
        tableName: "rag_documents",
      },
    };

    this.openai = new OpenAI({
      apiKey: this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
      baseURL: this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL"),
    });
  }

  getProviders(): { id: RagProviderType; name: string; configured: boolean }[] {
    return [
      {
        id: "qdrant",
        name: "Qdrant",
        configured: Boolean(this.providerConfig.qdrant?.url),
      },
      {
        id: "supabase",
        name: "Supabase",
        configured: Boolean(this.providerConfig.supabase?.url),
      },
      {
        id: "replit",
        name: "Replit PostgreSQL",
        configured: true,
      },
      {
        id: "none",
        name: "Disabled",
        configured: true,
      },
    ];
  }

  getCurrentProvider(): RagProviderType {
    return this.providerConfig.type;
  }

  setProvider(settings: RagSettingsRequest): void {
    this.providerConfig.type = settings.provider;
    if (settings.qdrant) {
      this.providerConfig.qdrant = settings.qdrant;
    }
    if (settings.supabase) {
      this.providerConfig.supabase = settings.supabase;
    }
    if (settings.replit) {
      this.providerConfig.replit = settings.replit;
    }
  }

  isAvailable(): boolean {
    if (this.providerConfig.type === "none") return false;
    if (this.providerConfig.type === "replit") return true;
    if (this.providerConfig.type === "qdrant")
      return Boolean(this.providerConfig.qdrant?.url);
    if (this.providerConfig.type === "supabase")
      return Boolean(this.providerConfig.supabase?.url);
    return false;
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
  }

  async getDocument(id: string): Promise<DocumentMetadata | null> {
    return this.documents.get(id) || null;
  }

  async uploadDocument(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<DocumentMetadata> {
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

    this.documents.set(id, doc);

    this.processDocument(id, buffer, mimeType);

    return doc;
  }

  async uploadFromUrl(url: string, name: string): Promise<DocumentMetadata> {
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

    this.documents.set(id, doc);

    this.processDocumentFromUrl(id, url);

    return doc;
  }

  async deleteDocument(id: string): Promise<boolean> {
    if (!this.documents.has(id)) {
      return false;
    }

    this.documents.delete(id);
    this.documentContents.delete(id);

    if (this.isAvailable()) {
      try {
        await this.deleteFromProvider(id);
      } catch (error) {
        console.error("Error deleting from provider:", error);
      }
    }

    return true;
  }

  async reindexDocument(id: string): Promise<DocumentMetadata | null> {
    const doc = this.documents.get(id);
    if (!doc) return null;

    const content = this.documentContents.get(id);
    if (!content) {
      doc.status = "error";
      doc.errorMessage = "No content to reindex";
      return doc;
    }

    doc.status = "processing";
    this.documents.set(id, doc);

    this.indexDocument(id, content);

    return doc;
  }

  private async processDocument(id: string, buffer: Buffer, mimeType: string) {
    try {
      let content: string;

      if (mimeType === "text/plain" || mimeType.includes("text")) {
        content = buffer.toString("utf-8");
      } else if (mimeType === "application/pdf") {
        content = `[PDF content from document - text extraction pending]`;
      } else {
        content = `[Document content - format: ${mimeType}]`;
      }

      this.documentContents.set(id, content);

      await this.indexDocument(id, content);

      const doc = this.documents.get(id);
      if (doc) {
        doc.status = "indexed";
        doc.chunkCount = Math.ceil(content.length / 500);
        this.documents.set(id, doc);
      }
    } catch (error) {
      console.error("Error processing document:", error);
      const doc = this.documents.get(id);
      if (doc) {
        doc.status = "error";
        doc.errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.documents.set(id, doc);
      }
    }
  }

  private async processDocumentFromUrl(id: string, url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "text/plain";

      const doc = this.documents.get(id);
      if (doc) {
        doc.size = this.formatFileSize(buffer.length);
        this.documents.set(id, doc);
      }

      await this.processDocument(id, buffer, contentType);
    } catch (error) {
      console.error("Error processing document from URL:", error);
      const doc = this.documents.get(id);
      if (doc) {
        doc.status = "error";
        doc.errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.documents.set(id, doc);
      }
    }
  }

  private async indexDocument(id: string, content: string) {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const chunks = this.splitIntoChunks(content, 500);
      const doc = this.documents.get(id);

      switch (this.providerConfig.type) {
        case "qdrant":
          await this.indexToQdrant(id, chunks, doc);
          break;
        case "supabase":
          await this.indexToSupabase(id, chunks, doc);
          break;
        case "replit":
          await this.indexToReplit(id, chunks, doc);
          break;
      }
    } catch (error) {
      console.error("Error indexing document:", error);
      throw error;
    }
  }

  private async indexToQdrant(
    id: string,
    chunks: string[],
    doc?: DocumentMetadata,
  ) {
    const config = this.providerConfig.qdrant;
    if (!config?.url) return;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embed(chunks[i]);
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
    doc?: DocumentMetadata,
  ) {
    const config = this.providerConfig.supabase;
    if (!config?.url) return;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embed(chunks[i]);
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

  private async indexToReplit(
    id: string,
    chunks: string[],
    doc?: DocumentMetadata,
  ) {
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embed(chunks[i]);
      await this.db.insert(schema.ragDocuments).values({
        documentId: id,
        content: chunks[i],
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify({ documentName: doc?.name }),
        chunkIndex: i,
      });
    }
  }

  private async deleteFromProvider(documentId: string) {
    switch (this.providerConfig.type) {
      case "qdrant":
        await this.deleteFromQdrant(documentId);
        break;
      case "supabase":
        await this.deleteFromSupabase(documentId);
        break;
      case "replit":
        await this.deleteFromReplit(documentId);
        break;
    }
  }

  private async deleteFromQdrant(documentId: string) {
    const config = this.providerConfig.qdrant;
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

  private async deleteFromSupabase(documentId: string) {
    const config = this.providerConfig.supabase;
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

  private async deleteFromReplit(documentId: string) {
    await this.db
      .delete(schema.ragDocuments)
      .where(sql`document_id = ${documentId}`);
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

  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }

  async search(query: string, limit = 3): Promise<SearchResult[]> {
    if (!this.isAvailable()) {
      return this.getLocalResults(query, limit);
    }

    try {
      switch (this.providerConfig.type) {
        case "qdrant":
          return await this.searchQdrant(query, limit);
        case "supabase":
          return await this.searchSupabase(query, limit);
        case "replit":
          return await this.searchReplit(query, limit);
        default:
          return this.getLocalResults(query, limit);
      }
    } catch (error) {
      console.error("Error searching:", error);
      return this.getLocalResults(query, limit);
    }
  }

  private async searchQdrant(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const config = this.providerConfig.qdrant;
    if (!config?.url) return [];

    const embedding = await this.embed(query);
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
  ): Promise<SearchResult[]> {
    const config = this.providerConfig.supabase;
    if (!config?.url) return [];

    const embedding = await this.embed(query);
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

    if (!response.ok) return this.getLocalResults(query, limit);

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

  private async searchReplit(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(query);

    const docs = await this.db.select().from(schema.ragDocuments).limit(100);

    const scored = docs
      .map((doc) => {
        const docEmbedding = doc.embedding ? JSON.parse(doc.embedding) : [];
        const score = this.cosineSimilarity(queryEmbedding, docEmbedding);
        return { ...doc, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((doc) => ({
      id: doc.id,
      score: doc.score,
      content: doc.content,
      metadata: { source: "replit" },
    }));
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

  private getLocalResults(query: string, limit: number): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const [id, content] of this.documentContents) {
      if (content.toLowerCase().includes(lowerQuery)) {
        const doc = this.documents.get(id);
        results.push({
          id,
          score: 0.8,
          content: content.substring(0, 500),
          metadata: {
            title: doc?.name,
            source: "local",
          },
        });
      }
    }

    return results.slice(0, limit);
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
}
