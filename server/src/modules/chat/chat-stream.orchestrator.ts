import { Injectable, Inject } from "@nestjs/common";
import { Response } from "express";
import { streamText, type Tool, type ModelMessage } from "ai";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { ToolRegistryService } from "./tool-registry.service";
import { PromptBuilderService } from "./prompt-builder.service";
import { AttachmentProcessorService } from "./attachment-processor.service";
import { LlmProviderFactory } from "./llm-provider.factory";
import { StreamEmitterService } from "./stream-emitter.service";
import { ToolExecutionPipeline } from "./tool-execution.pipeline";
import { AppLogger } from "../../utils/logger";
import {
  isLlmProviderError,
  getLlmProviderErrorBody,
} from "../../filters/llm-provider-exception.filter";
import { EphemeralClientPoolService } from "../../services/ephemeral-client-pool.service";
import type { McpServerConfig } from "../../services/mcp-host.service";
import type { ClientRuleDto, ClientSkillDto } from "./chat.dto";
import type { Attachment, StreamPart } from "./chat.types";
import { LlmSettings } from "../llm/llm.types";
import { ErpConfig } from "../erp/erp.types";
import { RagSettingsRequest } from "../rag/rag.types";

export interface ChatStreamContext {
  userId: string;
  rawText: string;
  res: Response;
  llmSettings?: LlmSettings;
  erpSettings?: Partial<ErpConfig>;
  ragSettings?: RagSettingsRequest;
  attachments?: Attachment[];
  clientHistory?: { role: "user" | "assistant"; content: string }[];
  mcpServers?: McpServerConfig[];
  clientRules?: ClientRuleDto[];
  clientSkills?: ClientSkillDto[];
  conversationSummary?: string;
  memoryFacts?: { key: string; value: string }[];
  userInstructions?: string;
}

@Injectable()
export class ChatStreamOrchestrator {
  constructor(
    @Inject(LlmService) private llmService: LlmService,
    @Inject(RagService) private ragService: RagService,
    @Inject(ToolRegistryService) private toolRegistry: ToolRegistryService,
    @Inject(PromptBuilderService) private promptBuilder: PromptBuilderService,
    @Inject(AttachmentProcessorService)
    private attachmentProcessor: AttachmentProcessorService,
    @Inject(LlmProviderFactory) private llmProviderFactory: LlmProviderFactory,
    @Inject(StreamEmitterService) private streamEmitter: StreamEmitterService,
    @Inject(ToolExecutionPipeline) private toolPipeline: ToolExecutionPipeline,
    @Inject(EphemeralClientPoolService)
    private ephemeralClientPool: EphemeralClientPoolService,
  ) {}

  /**
   * Stream chat response with tool calls, confidence scoring, and Guardian validation.
   */
  async streamChatResponse(context: ChatStreamContext): Promise<void> {
    const {
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
    } = context;

    // Setup SSE headers
    this.streamEmitter.setupSseHeaders(res);

    try {
      // Fetch RAG context
      let ragContext = "";
      try {
        const ragResults = await this.ragService.search(
          rawText,
          2,
          ragSettings,
        );
        ragContext = this.ragService.buildContext(ragResults);
      } catch (ragError) {
        AppLogger.warn("RAG search failed:", ragError);
      }

      // Build system prompt with RAG + rules + skills + memory
      const systemMessage = this.promptBuilder.buildSystemPrompt({
        ragContext,
        clientRules,
        clientSkills,
        memoryFacts,
        conversationSummary,
        userInstructions,
      });

      // Build message history (recent window)
      const RECENT_WINDOW = 6;
      const messages: ModelMessage[] = (clientHistory ?? [])
        .slice(-RECENT_WINDOW)
        .map((m) => {
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

      // Build user content (multimodal support)
      const userContent = await this.attachmentProcessor.buildUserContent(
        rawText,
        attachments,
      );

      if (Array.isArray(userContent) && userContent.length > 1) {
        messages.push({ role: "user", content: userContent });
      } else {
        messages.push({ role: "user", content: rawText });
      }

      // Setup provider & tools
      const provider = llmSettings?.provider ?? "replit";
      const baseURL = this.llmProviderFactory.getBaseUrlForLog(llmSettings);
      const modelName = this.llmService.getModel(llmSettings);
      const verbose = this.llmProviderFactory.isVerboseLogEnabled();

      const poolCredentials =
        this.llmProviderFactory.getPoolCredentialsForProvider(llmSettings);
      this.llmProviderFactory.assertApiKeyPresent(llmSettings);

      // Stream with pool
      await this.ephemeralClientPool.useClient(
        poolCredentials,
        async () => {
          const aiProvider =
            this.llmProviderFactory.createProvider(llmSettings);
          const tools: Record<
            string,
            Tool<unknown, unknown>
          > = await this.toolRegistry.getTools(
            userId,
            erpSettings,
            mcpServers ?? [],
            clientRules,
            clientSkills,
            memoryFacts,
          );

          if (verbose) {
            AppLogger.info(
              `[Conductor] LLM request started | provider=${provider} baseURL=${this.llmProviderFactory.maskBaseUrl(baseURL)} model=${modelName}`,
              undefined,
              "Conductor",
            );
          }

          // Stream text with Vercel AI SDK
          const result = streamText({
            model: aiProvider(modelName),
            system: systemMessage,
            messages,
            tools,
            maxOutputTokens: 2048,
            providerOptions: {
              openai: { truncation: "auto" },
            },
          });

          const toolCallsArgs = new Map<string, Record<string, unknown>>();

          // Process stream parts
          for await (const part of result.fullStream) {
            const partData = part as StreamPart;
            const textDelta = partData.text ?? partData.delta;

            // Text delta
            if (partData.type === "text-delta" && textDelta) {
              this.streamEmitter.emitTextDelta(res, textDelta);
            }

            // Tool call
            if (partData.type === "tool-call") {
              const args = (partData.args ?? partData.input ?? {}) as Record<
                string,
                unknown
              >;
              const toolName = partData.toolName ?? "unknown";
              const toolCallId = partData.toolCallId ?? "default";
              toolCallsArgs.set(toolCallId, args);

              this.streamEmitter.emitToolCall(res, toolName, args);

              if (verbose) {
                AppLogger.info(
                  `[Conductor] tool-call | toolName=${toolName} args=${JSON.stringify(args)}`,
                  undefined,
                  "Conductor",
                );
              }
            }

            // Tool result (with Guardian + Confidence + CoVe)
            if (partData.type === "tool-result") {
              const toolCallId = partData.toolCallId ?? "default";
              const args = toolCallsArgs.get(toolCallId) || {};
              const toolName = partData.toolName ?? "unknown";
              const resultOutput = partData.result ?? partData.output;
              const resultSummary =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);

              // Execute through pipeline (Guardian + Confidence)
              const executionResult = await this.toolPipeline.executeTool({
                userId,
                toolName,
                args,
                resultSummary,
                clientRules,
              });

              this.streamEmitter.emitToolResult(
                res,
                executionResult.toolName,
                executionResult.resultSummary,
                executionResult.confidence,
                executionResult.action,
              );

              if (verbose) {
                AppLogger.info(
                  `[Conductor] tool-result | toolName=${toolName} resultSummary=${resultSummary.slice(0, 100)}`,
                  undefined,
                  "Conductor",
                );
              }
            }
          }

          this.streamEmitter.emitDone(res);
        },
        true, // isStreaming
      );

      res.end();
    } catch (error) {
      AppLogger.error("Error in chat stream:", error);
      if (!res.headersSent) {
        if (isLlmProviderError(error)) {
          const body = getLlmProviderErrorBody(error);
          res.status(body.statusCode).json(body);
        } else {
          res.status(500).json({ error: "Failed to process message" });
        }
      } else {
        const msg = isLlmProviderError(error)
          ? getLlmProviderErrorBody(error).message
          : "Failed to process message";
        this.streamEmitter.emitError(res, msg);
        res.end();
      }
    }
  }
}
