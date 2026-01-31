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

export type RagProviderType = "qdrant" | "supabase" | "replit" | "none";

export interface RagSettingsRequest {
  provider: RagProviderType;
  qdrant?: {
    url: string;
    apiKey?: string;
    collectionName: string;
  };
  supabase?: {
    url: string;
    apiKey?: string;
    tableName: string;
  };
  replit?: {
    tableName: string;
  };
}

export interface DocumentMetadata {
  id: string;
  name: string;
  type: "pdf" | "txt" | "docx" | "xlsx" | "other";
  size: string;
  uploadedAt: Date;
  status: "indexed" | "processing" | "error";
  chunkCount?: number;
  errorMessage?: string;
}
