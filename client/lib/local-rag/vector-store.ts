import * as SQLite from "expo-sqlite";
import { AppLogger } from "../logger";

export interface LocalDocument {
  id: string;
  name: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: number;
}

interface LocalDocumentRow {
  id: string;
  name: string;
  content: string;
  embedding: string;
  metadata: string | null;
  created_at: number | string;
}

export interface LocalDocumentResult extends LocalDocument {
  score: number;
}

export class LocalVectorStore {
  private db: SQLite.SQLiteDatabase | null = null;

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync("axon_local_rag.db");
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_documents (
          id TEXT PRIMARY KEY,
          name TEXT,
          content TEXT,
          embedding TEXT,
          metadata TEXT,
          created_at INTEGER
        );
      `);
      AppLogger.info("Local Vector Store initialized", undefined, "RAG");
    } catch (error) {
      AppLogger.error("Failed to initialize local vector store", error, "RAG");
    }
  }

  async addDocument(doc: LocalDocument) {
    if (!this.db) await this.init();
    try {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO local_documents (id, name, content, embedding, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          doc.id,
          doc.name,
          doc.content,
          JSON.stringify(doc.embedding),
          JSON.stringify(doc.metadata),
          doc.createdAt,
        ],
      );
    } catch (error) {
      AppLogger.error("Failed to add document to local store", error, "RAG");
    }
  }

  async search(
    queryEmbedding: number[],
    limit: number = 5,
  ): Promise<LocalDocumentResult[]> {
    if (!this.db) await this.init();
    try {
      const docs = await this.db!.getAllAsync<LocalDocumentRow>(
        "SELECT * FROM local_documents",
      );

      const scoredDocs = docs.map((doc) => {
        let embedding: number[] = [];
        try {
          embedding = JSON.parse(doc.embedding);
        } catch {
          return {
            id: doc.id,
            name: doc.name,
            content: doc.content,
            embedding: [],
            metadata: {},
            createdAt: Number(doc.created_at),
            score: 0,
          };
        }

        return {
          id: doc.id,
          name: doc.name,
          content: doc.content,
          embedding,
          metadata: doc.metadata ? JSON.parse(doc.metadata) : {},
          createdAt: Number(doc.created_at),
          score: this.cosineSimilarity(queryEmbedding, embedding),
        };
      });

      return scoredDocs.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      AppLogger.error("Failed to search local store", error, "RAG");
      return [];
    }
  }

  async deleteDocument(id: string) {
    if (!this.db) await this.init();
    await this.db!.runAsync("DELETE FROM local_documents WHERE id = ?", [id]);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}

export const localVectorStore = new LocalVectorStore();
