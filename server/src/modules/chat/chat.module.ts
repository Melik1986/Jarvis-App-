import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
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

@Module({
  imports: [LlmModule, RagModule, ErpModule, AuthModule, RulebookModule],
  controllers: [ChatController, ConductorController],
  providers: [
    ChatService,
    ToolRegistryService,
    ConfidenceScorerService,
    CoveWorkflowService,
    PromptInjectionGuard,
    GuardianGuard,
  ],
})
export class ChatModule {}
