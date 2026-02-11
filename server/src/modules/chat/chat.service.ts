import { Injectable, Inject } from "@nestjs/common";
import { Response } from "express";
import { streamText, type Tool, type ModelMessage } from "ai";
import { toFile } from "openai/uploads";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { ErpService } from "../erp/erp.service";
import { EphemeralClientPoolService } from "../../services/ephemeral-client-pool.service";
import { PromptInjectionGuard } from "../../guards/prompt-injection.guard";
import { LlmSettings } from "../llm/llm.types";
import { ErpConfig } from "../erp/erp.types";
import { RagSettingsRequest } from "../rag/rag.types";
import { AppLogger } from "../../utils/logger";

import { ToolRegistryService } from "./tool-registry.service";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { CoveWorkflowService } from "./cove-workflow.service";
import { GuardianGuard } from "../../guards/guardian.guard";
import { PromptBuilderService } from "./prompt-builder.service";
import { AttachmentProcessorService } from "./attachment-processor.service";
import { LlmProviderFactory } from "./llm-provider.factory";
import { ChatStreamOrchestrator } from "./chat-stream.orchestrator";
import { VoiceStreamOrchestrator } from "./voice-stream.orchestrator";
import { DiffPreviewService } from "./diff-preview.service";
import { VerificationPipeline } from "./verification-pipeline.service";
import type { McpServerConfig } from "../../services/mcp-host.service";
import type { ClientRuleDto, ClientSkillDto } from "./chat.dto";
import type { Attachment, StreamPart } from "./chat.types";

// Tools will be created dynamically in the service with execute handlers

@Injectable()
export class ChatService {
  // Stateless: no in-memory storage
  // Conversations and messages are stored on client (AsyncStorage)
  // Server only processes requests without state

  constructor(
    @Inject(LlmService) private llmService: LlmService,
    @Inject(RagService) private ragService: RagService,
    @Inject(ErpService) private erpService: ErpService,
    @Inject(EphemeralClientPoolService)
    private ephemeralClientPool: EphemeralClientPoolService,
    @Inject(PromptInjectionGuard)
    private promptInjectionGuard: PromptInjectionGuard,
    @Inject(ToolRegistryService) private toolRegistry: ToolRegistryService,
    @Inject(ConfidenceScorerService)
    private confidenceScorer: ConfidenceScorerService,
    @Inject(CoveWorkflowService) private coveWorkflow: CoveWorkflowService,
    @Inject(GuardianGuard) private guardian: GuardianGuard,
    @Inject(PromptBuilderService) private promptBuilder: PromptBuilderService,
    @Inject(AttachmentProcessorService)
    private attachmentProcessor: AttachmentProcessorService,
    @Inject(LlmProviderFactory) private llmProviderFactory: LlmProviderFactory,
    @Inject(ChatStreamOrchestrator)
    private chatStreamOrchestrator: ChatStreamOrchestrator,
    @Inject(VoiceStreamOrchestrator)
    private voiceStreamOrchestrator: VoiceStreamOrchestrator,
    @Inject(DiffPreviewService) private diffPreview: DiffPreviewService,
    @Inject(VerificationPipeline)
    private verificationPipeline: VerificationPipeline,
  ) {}

  // Zero-storage: all CRUD removed. Client manages conversations/messages locally.
  // Server only processes chat requests.

  private getTranscriptionModel(model?: string): string {
    return model || "gpt-4o-mini-transcribe";
  }

  private async transcribeAudio(
    audioBase64: string,
    llmSettings?: LlmSettings,
    transcriptionModel?: string,
  ): Promise<string> {
    const poolCredentials =
      this.llmProviderFactory.getPoolCredentialsForProvider(llmSettings);
    if (poolCredentials.llmProvider !== "replit" && !poolCredentials.llmKey) {
      throw new Error(
        `API key is required for provider: ${poolCredentials.llmProvider}`,
      );
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const file = await toFile(audioBuffer, "voice-input.wav");
    const model = this.getTranscriptionModel(transcriptionModel);

    return await this.ephemeralClientPool.useClient(
      poolCredentials,
      async (client) => {
        const response = await client.audio.transcriptions.create({
          file,
          model,
        });
        return response.text || "";
      },
      false,
    );
  }

  async streamResponse(
    userId: string,
    rawText: string,
    res: Response,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
    attachments?: Attachment[],
    clientHistory?: { role: "user" | "assistant"; content: string }[],
    mcpServers?: McpServerConfig[],
    clientRules?: ClientRuleDto[],
    clientSkills?: ClientSkillDto[],
    conversationSummary?: string,
    memoryFacts?: { key: string; value: string }[],
    userInstructions?: string,
  ) {
    // Check for prompt injection
    const injectionCheck = this.promptInjectionGuard.detectInjection(rawText);
    if (injectionCheck.requireManualReview) {
      res.status(400).json({
        error: "Prompt injection detected",
        warning: injectionCheck.warning,
        requiresConfirmation: true,
      });
      return;
    }

    // History comes from client (zero-storage)
    const history = clientHistory ?? [];

    // Search RAG for context
    let ragContext = "";
    try {
      const ragResults = await this.ragService.search(rawText, 2, ragSettings);
      ragContext = this.ragService.buildContext(ragResults);
    } catch (ragError) {
      AppLogger.warn("RAG search failed:", ragError);
    }

    // Build system message with RAG context + user instructions from rules/skills
    // Note: systemMessage is built by prompt builder and used in orchestrators
    this.promptBuilder.buildSystemPrompt({
      ragContext,
      clientRules,
      clientSkills,
      memoryFacts,
      conversationSummary,
      userInstructions,
    });

    // Build messages array for Vercel AI SDK
    // Client now sends only recent window (6 msgs) + summary for older context
    const RECENT_WINDOW = 6;
    const messages: ModelMessage[] = history.slice(-RECENT_WINDOW).map((m) => {
      // Strip non-text parts (images/files) from multimodal history to save tokens
      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? (m.content as { type: string; text?: string }[])
                .filter((p) => p.type === "text")
                .map((p) => p.text ?? "")
                .join("\n")
            : String(m.content);
      return { role: m.role as "user" | "assistant", content };
    }) as ModelMessage[];

    // Handle multimodal content
    const userContent = await this.attachmentProcessor.buildUserContent(
      rawText,
      attachments,
    );

    if (Array.isArray(userContent) && userContent.length > 1) {
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: rawText });
    }

    // Set up SSE
    // Delegate to ChatStreamOrchestrator
    await this.chatStreamOrchestrator.streamChatResponse({
      userId,
      rawText,
      res,
      llmSettings,
      erpSettings,
      ragSettings,
      attachments,
      clientHistory,
      mcpServers,
      clientRules,
      clientSkills,
      conversationSummary,
      memoryFacts,
      userInstructions,
    });
  }

  async streamVoiceResponse(
    userId: string,
    audioBase64: string,
    res: Response,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
    transcriptionModel?: string,
    userInstructions?: string,
  ) {
    // Transcribe audio first
    const userTranscript = await this.transcribeAudio(
      audioBase64,
      llmSettings,
      transcriptionModel,
    );

    // Setup SSE and emit transcript
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(
      `data: ${JSON.stringify({
        type: "user_transcript",
        data: userTranscript,
      })}\n\n`,
    );

    if (!userTranscript.trim()) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "Empty transcription",
        })}\n\n`,
      );
      res.end();
      return;
    }

    const injectionCheck =
      this.promptInjectionGuard.detectInjection(userTranscript);
    if (injectionCheck.requireManualReview) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "Prompt injection detected",
        })}\n\n`,
      );
      res.end();
      return;
    }

    // Delegate streaming to VoiceStreamOrchestrator
    await this.voiceStreamOrchestrator.streamVoiceResponse({
      userId,
      userTranscript,
      res,
      llmSettings,
      erpSettings,
      ragSettings,
      userInstructions,
    });
  }

  /**
   * Parse raw text (e.g. from Whisper) into structured tool calls and assistant text.
   * Used by POST /api/conductor/parse for Swagger/testing without streaming.
   */
  async parseRawText(
    userId: string,
    rawText: string,
    llmSettings?: LlmSettings,
    erpSettings?: Partial<ErpConfig>,
    ragSettings?: RagSettingsRequest,
  ): Promise<{
    rawText: string;
    toolCalls: { toolName: string; args: unknown; resultSummary: string }[];
    assistantText: string;
    warning?: string;
    requiresConfirmation?: boolean;
  }> {
    // Check for prompt injection
    const injectionCheck = this.promptInjectionGuard.detectInjection(rawText);
    if (injectionCheck.requireManualReview) {
      return {
        rawText,
        toolCalls: [],
        assistantText: "",
        warning: injectionCheck.warning,
        requiresConfirmation: true,
      };
    }

    let ragContext = "";
    try {
      const ragResults = await this.ragService.search(rawText, 2, ragSettings);
      ragContext = this.ragService.buildContext(ragResults);
    } catch {
      // ignore RAG errors
    }

    const modelName = this.llmService.getModel(llmSettings);

    // Extract credentials for pool
    const poolCredentials =
      this.llmProviderFactory.getPoolCredentialsForProvider(llmSettings);

    // Use ephemeral client pool for parsing
    return await this.ephemeralClientPool.useClient(
      poolCredentials,
      async () => {
        const aiProvider = this.llmProviderFactory.createProvider(llmSettings);
        const tools: Record<
          string,
          Tool<unknown, unknown>
        > = await this.toolRegistry.getTools(userId, erpSettings, []);

        const systemMsg = this.promptBuilder.buildSystemPrompt({
          ragContext,
        });

        const result = streamText({
          model: aiProvider(modelName),
          system: systemMsg,
          messages: [{ role: "user", content: rawText }],
          tools,
          maxOutputTokens: 2048,
        });

        const toolCallsAcc: {
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
          resultSummary?: string;
        }[] = [];
        let assistantText = "";

        for await (const part of result.fullStream) {
          const partData = part as StreamPart;
          const textDelta = partData.text ?? partData.delta;
          if (partData.type === "text-delta" && textDelta) {
            assistantText += textDelta;
          }
          if (partData.type === "tool-call") {
            const args = (partData.args ?? partData.input ?? {}) as Record<
              string,
              unknown
            >;
            toolCallsAcc.push({
              toolCallId: partData.toolCallId ?? "",
              toolName: partData.toolName ?? "unknown",
              args,
            });
          }
          if (partData.type === "tool-result") {
            let out = "";
            const resultOutput = partData.result ?? partData.output;
            if (resultOutput !== undefined) {
              const raw =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);
              out = raw.slice(0, 300) + (raw.length > 300 ? "…" : "");
            }
            const entry = toolCallsAcc.find(
              (e) => e.toolCallId === partData.toolCallId,
            );
            if (entry) entry.resultSummary = out;
          }
        }

        // Apply CoVe workflow: inject read tools before write tools
        // Delegate to VerificationPipeline for cleaner separation of concerns
        const finalToolCalls = await this.verificationPipeline.processTools(
          toolCallsAcc,
          userId,
          erpSettings,
        );

        return {
          rawText,
          toolCalls: finalToolCalls,
          assistantText,
        };
      },
      false, // isStreaming = false (though it uses streamText internally, it's a single request)
    );
  }
}
