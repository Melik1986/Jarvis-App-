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
