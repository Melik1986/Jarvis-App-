import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  RagConfig,
  SearchResult,
  QdrantSearchResult,
  DocumentMetadata,
} from "./rag.types";
import { randomUUID } from "crypto";

@Injectable()
export class RagService {
  private config: RagConfig;
  private isConfigured: boolean;
  private openai: OpenAI;
  private documents: Map<string, DocumentMetadata> = new Map();
  private documentContents: Map<string, string> = new Map();

  constructor(private configService: ConfigService) {
    this.config = {
      url: this.configService.get("QDRANT_URL") || "",
      apiKey: this.configService.get("QDRANT_API_KEY"),
      collectionName: "kb_jarvis",
    };
    this.isConfigured = Boolean(this.config.url);

    this.openai = new OpenAI({
      apiKey: this.configService.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
      baseURL: this.configService.get("AI_INTEGRATIONS_OPENAI_BASE_URL"),
    });
  }

  isAvailable(): boolean {
    return this.isConfigured;
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

    if (this.isConfigured) {
      try {
        await this.deleteFromQdrant(id);
      } catch (error) {
        console.error("Error deleting from Qdrant:", error);
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
    if (!this.isConfigured) {
      return;
    }

    try {
      const chunks = this.splitIntoChunks(content, 500);
      const doc = this.documents.get(id);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.embed(chunks[i]);

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
          },
        );
      }
    } catch (error) {
      console.error("Error indexing document:", error);
      throw error;
    }
  }

  private async deleteFromQdrant(documentId: string) {
    await fetch(
      `${this.config.url}/collections/${this.config.collectionName}/points/delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && { "api-key": this.config.apiKey }),
        },
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: "documentId",
                match: { value: documentId },
              },
            ],
          },
        }),
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

  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }

  async search(
    query: string,
    limit = 3,
    customConfig?: RagConfig,
  ): Promise<SearchResult[]> {
    const config = customConfig || this.config;
    const isConfigured = Boolean(config.url);

    if (!isConfigured) {
      return this.getLocalResults(query, limit);
    }

    try {
      const embedding = await this.embed(query);

      const response = await fetch(
        `${config.url}/collections/${config.collectionName}/points/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey && { "api-key": config.apiKey }),
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
      const results: QdrantSearchResult[] = data.result || [];

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
      return this.getLocalResults(query, limit);
    }
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
