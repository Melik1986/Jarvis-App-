/**
 * Standardized error response format from API
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  code?: string;
  details?: string;
  timestamp: string;
  path?: string;
}

/**
 * Error codes for different types of errors
 */
export enum ErrorCode {
  // LLM Provider errors
  LLM_PROVIDER_ERROR = "LLM_PROVIDER_ERROR",
  LLM_INVALID_API_KEY = "LLM_INVALID_API_KEY",
  LLM_RATE_LIMIT = "LLM_RATE_LIMIT",
  LLM_QUOTA_EXCEEDED = "LLM_QUOTA_EXCEEDED",
  LLM_CONTEXT_LENGTH = "LLM_CONTEXT_LENGTH",

  // ERP errors
  ERP_CONNECTION_ERROR = "ERP_CONNECTION_ERROR",
  ERP_AUTHENTICATION_ERROR = "ERP_AUTHENTICATION_ERROR",
  ERP_INVALID_RESPONSE = "ERP_INVALID_RESPONSE",

  // RAG errors
  RAG_VECTOR_STORE_ERROR = "RAG_VECTOR_STORE_ERROR",
  RAG_EMBEDDING_ERROR = "RAG_EMBEDDING_ERROR",

  // Auth errors
  AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN",
  AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
  AUTH_INSUFFICIENT_PERMISSIONS = "AUTH_INSUFFICIENT_PERMISSIONS",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // MCP errors
  MCP_CONNECTION_ERROR = "MCP_CONNECTION_ERROR",
  MCP_TOOL_EXECUTION_ERROR = "MCP_TOOL_EXECUTION_ERROR",

  // Guardian errors
  GUARDIAN_RULE_VIOLATION = "GUARDIAN_RULE_VIOLATION",
  GUARDIAN_VALIDATION_FAILED = "GUARDIAN_VALIDATION_FAILED",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Generic errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_FOUND = "NOT_FOUND",
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
}

export type ToolCall = {
  toolName: string;
  args: Record<string, unknown>;
  resultSummary?: string;
  confidence?: number;
  isVerification?: boolean;
  action?: "allow" | "reject" | "warn" | "require_confirmation";
  diffPreview?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  status?: "calling" | "done";
};

export type Attachment = {
  name: string;
  type: "image" | "file";
  mimeType: string;
  uri: string;
  base64?: string;
};

export type ChatMessage = {
  id: number;
  /** SQLite UUID — used for fork/regenerate operations on local DB */
  _localId?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: Attachment[];
  toolCalls?: {
    toolName: string;
    args: Record<string, unknown>;
    resultSummary?: string;
    confidence?: number;
    isVerification?: boolean;
    diffPreview?: {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };
  }[];
  metadata?: {
    confidenceScore?: number;
    ruleViolations?: string[];
  };
};

export type Conversation = {
  id: number | string;
  title: string;
  createdAt: string;
  messages?: ChatMessage[];
  /** Local SQLite UUID (zero-storage) */
  _localId?: string;
};

/** Stateless chat request payload (zero-storage) */
export type ChatRequestPayload = {
  content: string;
  history?: { role: "user" | "assistant"; content: string }[];
  userInstructions?: string;
  rules?: {
    id: string;
    name: string;
    condition: string;
    action: string;
    message?: string;
    priority?: number;
  }[];
  skills?: {
    id: string;
    name: string;
    description?: string;
    code: string;
    inputSchema?: string;
    outputSchema?: string;
  }[];
  attachments?: Attachment[];
  llmSettings?: {
    provider: string;
    baseUrl?: string;
    apiKey?: string;
    modelName?: string;
  };
  erpSettings?: Record<string, unknown>;
  ragSettings?: Record<string, unknown>;
};
