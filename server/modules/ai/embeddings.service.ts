import { openaiService } from "./openai.service";

/**
 * Service for generating embeddings using OpenAI.
 * Used for RAG (Retrieval-Augmented Generation) with Qdrant.
 */
export class EmbeddingsService {
  private model = "text-embedding-3-small";
  private dimensions = 1536;

  /**
   * Generate embedding vector for a single text
   */
  async embed(text: string): Promise<number[]> {
    const client = openaiService.getClient();
    const response = await client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
    });
    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
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
  getDimensions(): number {
    return this.dimensions;
  }
}

// Singleton instance
export const embeddingsService = new EmbeddingsService();
