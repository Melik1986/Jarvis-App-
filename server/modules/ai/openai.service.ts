import OpenAI from "openai";

/**
 * OpenAI service for chat completions and other AI operations.
 * Centralized AI client for the application.
 */
export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Create a chat completion with optional tools (function calling)
   */
  async createChatCompletion(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    model?: string;
    tools?: OpenAI.Chat.ChatCompletionTool[];
    stream?: boolean;
    maxTokens?: number;
  }) {
    return this.client.chat.completions.create({
      model: params.model || "gpt-4o",
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tools ? "auto" : undefined,
      stream: params.stream ?? false,
      max_completion_tokens: params.maxTokens || 2048,
    });
  }

  /**
   * Transcribe audio using Whisper
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    format: "wav" | "mp3" = "wav",
  ): Promise<string> {
    const { toFile } = await import("openai");
    const file = await toFile(audioBuffer, `audio.${format}`);
    const response = await this.client.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });
    return response.text;
  }
}

// Singleton instance
export const openaiService = new OpenAIService();
