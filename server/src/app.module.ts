import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { DbModule } from "./db/db.module";
import { ChatModule } from "./modules/chat/chat.module";
import { LlmModule } from "./modules/llm/llm.module";
import { ErpModule } from "./modules/erp/erp.module";
import { RagModule } from "./modules/rag/rag.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ServicesModule } from "./services/services.module";
import { JweDecryptionInterceptor } from "./interceptors/jwe-decryption.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env"],
    }),
    ServicesModule,
    DbModule,
    ChatModule,
    LlmModule,
    ErpModule,
    RagModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: JweDecryptionInterceptor,
    },
  ],
})
export class AppModule {}
