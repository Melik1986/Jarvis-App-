export interface RagConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: {
    title?: string;
    source?: string;
    category?: string;
    [key: string]: unknown;
  };
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: {
    content: string;
    title?: string;
    source?: string;
    category?: string;
    [key: string]: unknown;
  };
}

export interface RagSettingsRequest {
  provider: "qdrant" | "none";
  qdrant?: {
    url: string;
    apiKey?: string;
    collectionName: string;
  };
}
