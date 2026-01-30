import type {
  SearchResult,
  RagConfig,
  QdrantSearchResult,
  DocumentPayload,
} from "./rag.types";
import { embeddingsService } from "../ai";

/**
 * RAG (Retrieval-Augmented Generation) service using Qdrant.
 * Provides semantic search over knowledge base documents.
 */
export class RagService {
  private config: RagConfig;
  private isConfigured: boolean;

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
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Search for relevant documents by query text
   */
  async search(query: string, limit = 3): Promise<SearchResult[]> {
    if (!this.isConfigured) {
      return this.getMockResults(query, limit);
    }

    try {
      // Generate embedding for query
      const embedding = await embeddingsService.embed(query);

      // Search in Qdrant
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
      return this.getMockResults(query, limit);
    }
  }

  /**
   * Add document to knowledge base
   */
  async addDocument(
    content: string,
    metadata?: Partial<DocumentPayload>,
  ): Promise<string> {
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
  async ensureCollection(): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const checkResponse = await fetch(
        `${this.config.url}/collections/${this.config.collectionName}`,
        {
          headers: this.config.apiKey ? { "api-key": this.config.apiKey } : {},
        },
      );

      if (checkResponse.status === 404) {
        // Collection doesn't exist, create it
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

  // =====================
  // Mock data for demo/testing
  // =====================

  private getMockResults(query: string, limit: number): SearchResult[] {
    const mockDocs: SearchResult[] = [
      {
        id: "doc-1",
        score: 0.92,
        content:
          "Для оформления возврата товара необходимо: 1) Проверить срок возврата (14 дней для непродовольственных товаров). 2) Убедиться в сохранности товарного вида и упаковки. 3) Оформить документ 'Возврат от покупателя' в 1С.",
        metadata: {
          title: "Регламент возврата товаров",
          category: "procedures",
        },
      },
      {
        id: "doc-2",
        score: 0.87,
        content:
          "Приём товара на склад: 1) Проверить соответствие накладной и фактического количества. 2) Осмотреть товар на наличие повреждений. 3) Провести документ 'Поступление товаров' в 1С. 4) Разместить товар в зоне хранения.",
        metadata: {
          title: "Инструкция по приёмке товара",
          category: "warehouse",
        },
      },
      {
        id: "doc-3",
        score: 0.85,
        content:
          "Инвентаризация проводится ежеквартально. Порядок: 1) Создать документ 'Инвентаризация' в 1С. 2) Распечатать инвентаризационные описи. 3) Провести подсчёт товаров. 4) Внести фактические остатки. 5) Оформить излишки/недостачи.",
        metadata: {
          title: "Порядок проведения инвентаризации",
          category: "inventory",
        },
      },
      {
        id: "doc-4",
        score: 0.78,
        content:
          "Скидки для клиентов: оптовым покупателям от 10%, постоянным клиентам от 5%. Скидки не суммируются. Максимальная скидка без согласования руководства - 15%.",
        metadata: { title: "Политика скидок", category: "sales" },
      },
    ];

    // Simple keyword matching for demo
    const lowerQuery = query.toLowerCase();
    const filtered = mockDocs
      .filter(
        (doc) =>
          doc.content.toLowerCase().includes(lowerQuery) ||
          doc.metadata?.title?.toLowerCase().includes(lowerQuery),
      )
      .slice(0, limit);

    // Return all if no matches (for demo purposes)
    return filtered.length > 0 ? filtered : mockDocs.slice(0, limit);
  }
}

// Singleton instance
export const ragService = new RagService();
