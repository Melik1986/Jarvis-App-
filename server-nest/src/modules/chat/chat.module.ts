import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { LlmModule } from "../llm/llm.module";
import { RagModule } from "../rag/rag.module";
import { ErpModule } from "../erp/erp.module";

@Module({
  imports: [LlmModule, RagModule, ErpModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
