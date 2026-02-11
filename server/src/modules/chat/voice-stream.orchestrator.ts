import { Injectable, Inject } from "@nestjs/common";
import { Response } from "express";
import { streamText, type Tool, type ModelMessage } from "ai";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { ToolRegistryService } from "./tool-registry.service";
import { PromptBuilderService } from "./prompt-builder.service";
import { LlmProviderFactory } from "./llm-provider.factory";
import { StreamEmitterService } from "./stream-emitter.service";
import { ToolExecutionPipeline } from "./tool-execution.pipeline";
import { AppLogger } from "../../utils/logger";
import {
  isLlmProviderError,
  getLlmProviderErrorBody,
} from "../../filters/llm-provider-exception.filter";
import { EphemeralClientPoolService } from "../../services/ephemeral-client-pool.service";
import type { StreamPart } from "./chat.types";
import { LlmSettings } from "../llm/llm.types";
import { ErpConfig } from "../erp/erp.types";
import { RagSettingsRequest } from "../rag/rag.types";

export interface VoiceStreamContext {
  userId: string;
  userTranscript: string;
  res: Response;
  llmSettings?: LlmSettings;
  erpSettings?: Partial<ErpConfig>;
  ragSettings?: RagSettingsRequest;
  userInstructions?: string;
}

@Injectable()
export class VoiceStreamOrchestrator {
  constructor(
    @Inject(LlmService) private llmService: LlmService,
    @Inject(RagService) private ragService: RagService,
    @Inject(ToolRegistryService) private toolRegistry: ToolRegistryService,
    @Inject(PromptBuilderService) private promptBuilder: PromptBuilderService,
    @Inject(LlmProviderFactory) private llmProviderFactory: LlmProviderFactory,
    @Inject(StreamEmitterService) private streamEmitter: StreamEmitterService,
    @Inject(ToolExecutionPipeline) private toolPipeline: ToolExecutionPipeline,
    @Inject(EphemeralClientPoolService)
    private ephemeralClientPool: EphemeralClientPoolService,
  ) {}

  /**
   * Stream voice response with transcript + tool execution.
   */
  async streamVoiceResponse(context: VoiceStreamContext): Promise<void> {
    const {
      userId,
      userTranscript,
      res,
      llmSettings,
      erpSettings,
      ragSettings,
      userInstructions,
    } = context;

    // Setup SSE headers
    this.streamEmitter.setupSseHeaders(res);

    try {
      // Fetch RAG context
      let ragContext = "";
      try {
        const ragResults = await this.ragService.search(
          userTranscript,
          2,
          ragSettings,
        );
        ragContext = this.ragService.buildContext(ragResults);
      } catch (ragError) {
        AppLogger.warn("RAG search failed:", ragError);
      }

      // Build system prompt
      const systemMessage = this.promptBuilder.buildSystemPrompt({
        ragContext,
        userInstructions,
      });

      // Build messages
      const messages: ModelMessage[] = [
        { role: "user", content: userTranscript },
      ];

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
          > = await this.toolRegistry.getTools(userId, erpSettings, []);

          if (verbose) {
            AppLogger.info(
              `[Voice] LLM request started | provider=${provider} baseURL=${this.llmProviderFactory.maskBaseUrl(baseURL)} model=${modelName}`,
              undefined,
              "Voice",
            );
          }

          // Stream text
          const result = streamText({
            model: aiProvider(modelName),
            system: systemMessage,
            messages,
            tools,
            maxOutputTokens: 2048,
          });

          const toolCallsArgs = new Map<string, Record<string, unknown>>();

          // Process stream parts
          for await (const part of result.fullStream) {
            const partData = part as StreamPart;
            const textDelta = partData.text ?? partData.delta;

            // Text delta (transcript)
            if (partData.type === "text-delta" && textDelta) {
              this.streamEmitter.emitVoiceTranscript(res, textDelta);
            }

            // Tool call
            if (partData.type === "tool-call") {
              const args = (partData.args ?? partData.input ?? {}) as Record<
                string,
                unknown
              >;
              const toolCallId = partData.toolCallId ?? "default";
              toolCallsArgs.set(toolCallId, args);
            }

            // Tool result (with Guardian + Confidence)
            if (partData.type === "tool-result") {
              const toolCallId = partData.toolCallId ?? "default";
              const args = toolCallsArgs.get(toolCallId) || {};
              const toolName = partData.toolName ?? "unknown";
              const resultOutput = partData.result ?? partData.output;
              const resultSummary =
                typeof resultOutput === "string"
                  ? resultOutput
                  : JSON.stringify(resultOutput);

              // Execute through pipeline
              await this.toolPipeline.executeTool({
                userId,
                toolName,
                args,
                resultSummary,
              });

              if (verbose) {
                AppLogger.info(
                  `[Voice] tool-result | toolName=${toolName} resultSummary=${resultSummary.slice(0, 100)}`,
                  undefined,
                  "Voice",
                );
              }
            }
          }

          this.streamEmitter.emitVoiceTranscript(res, "", "done");
        },
        true, // isStreaming
      );

      res.end();
    } catch (error) {
      AppLogger.error("Error in voice stream:", error);
      if (!res.headersSent) {
        if (isLlmProviderError(error)) {
          const body = getLlmProviderErrorBody(error);
          res.status(body.statusCode).json(body);
        } else {
          res.status(500).json({ error: "Failed to process voice message" });
        }
      } else {
        const msg = isLlmProviderError(error)
          ? getLlmProviderErrorBody(error).message
          : "Failed to process voice message";
        this.streamEmitter.emitError(res, msg);
        res.end();
      }
    }
  }
}
