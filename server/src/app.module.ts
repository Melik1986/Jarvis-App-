import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module";
import { ChatModule } from "./modules/chat/chat.module";
import { LlmModule } from "./modules/llm/llm.module";
import { ErpModule } from "./modules/erp/erp.module";
import { RagModule } from "./modules/rag/rag.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../.env",
    }),
    DbModule,
    ChatModule,
    LlmModule,
    ErpModule,
    RagModule,
    AuthModule,
  ],
})
export class AppModule {}
