/**
 * Types for RAG (Retrieval-Augmented Generation) with Qdrant
 */

export interface RagConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
}

export interface SearchResult {
  /** Document ID */
  id: string;
  /** Relevance score (0-1) */
  score: number;
  /** Document content/text */
  content: string;
  /** Document metadata */
  metadata?: {
    title?: string;
    source?: string;
    category?: string;
    [key: string]: unknown;
  };
}

export interface DocumentPayload {
  content: string;
  title?: string;
  source?: string;
  category?: string;
  [key: string]: unknown;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload: DocumentPayload;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: DocumentPayload;
}
