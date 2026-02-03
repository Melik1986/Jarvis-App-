import { apiRequest } from "../query-client";
import { AppLogger } from "../logger";

export class EmbeddingService {
  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await apiRequest("POST", "/api/documents/embeddings", {
        text,
      });
      if (response.ok) {
        const data = await response.json();
        return data.embedding;
      }
      throw new Error(`Failed to get embeddings: ${response.statusText}`);
    } catch (error) {
      AppLogger.error("Error fetching embeddings", error, "RAG");
      return new Array(1536).fill(0); // Return zero vector on error
    }
  }
}

export const embeddingService = new EmbeddingService();
