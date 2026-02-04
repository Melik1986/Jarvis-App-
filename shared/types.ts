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
  id: number;
  title: string;
  createdAt: string;
  messages?: ChatMessage[];
};
