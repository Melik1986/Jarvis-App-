import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { RagConfig, SearchResult, QdrantSearchResult } from "./rag.types";

@Injectable()
export class RagService {
  private config: RagConfig;
  private isConfigured: boolean;
  private openai: OpenAI;

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
      return this.getMockResults(query, limit);
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
      return this.getMockResults(query, limit);
    }
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
}
