import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ConductorController } from "../conductor/conductor.controller";
import { PromptInjectionGuard } from "../../guards/prompt-injection.guard";
import { LlmModule } from "../llm/llm.module";
import { RagModule } from "../rag/rag.module";
import { ErpModule } from "../erp/erp.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [LlmModule, RagModule, ErpModule, AuthModule],
  controllers: [ChatController, ConductorController],
  providers: [ChatService, PromptInjectionGuard],
})
export class ChatModule {}
