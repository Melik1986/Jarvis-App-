import { Module } from "@nestjs/common";
import { ChatController, VoiceController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ToolRegistryService } from "./tool-registry.service";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { CoveWorkflowService } from "./cove-workflow.service";
import { GuardianGuard } from "../../guards/guardian.guard";
import { ConductorController } from "../conductor/conductor.controller";
import { PromptInjectionGuard } from "../../guards/prompt-injection.guard";
import { LlmModule } from "../llm/llm.module";
import { RagModule } from "../rag/rag.module";
import { ErpModule } from "../erp/erp.module";
import { AuthModule } from "../auth/auth.module";
import { RulebookModule } from "../rules/rulebook.module";
import { SkillsModule } from "../skills/skill.module";
import { PromptBuilderService } from "./prompt-builder.service";
import { AttachmentProcessorService } from "./attachment-processor.service";
import { LlmProviderFactory } from "./llm-provider.factory";
import { StreamEmitterService } from "./stream-emitter.service";
import { ToolExecutionPipeline } from "./tool-execution.pipeline";
import { ChatStreamOrchestrator } from "./chat-stream.orchestrator";
import { VoiceStreamOrchestrator } from "./voice-stream.orchestrator";
import { DiffPreviewService } from "./diff-preview.service";
import { VerificationPipeline } from "./verification-pipeline.service";
import { ChatRequestContextFactory } from "./chat-request-context.factory";
import { ChatSecurityService } from "./chat-security.service";
import { ChatStreamFacade } from "./chat-stream.facade";

@Module({
  imports: [
    LlmModule,
    RagModule,
    ErpModule,
    AuthModule,
    RulebookModule,
    SkillsModule,
  ],
  controllers: [ChatController, VoiceController, ConductorController],
  providers: [
    ChatService,
    ToolRegistryService,
    ConfidenceScorerService,
    CoveWorkflowService,
    PromptInjectionGuard,
    GuardianGuard,
    PromptBuilderService,
    AttachmentProcessorService,
    LlmProviderFactory,
    StreamEmitterService,
    ToolExecutionPipeline,
    ChatStreamOrchestrator,
    VoiceStreamOrchestrator,
    ChatRequestContextFactory,
    ChatSecurityService,
    ChatStreamFacade,
    DiffPreviewService,
    VerificationPipeline,
  ],
})
export class ChatModule {}
