import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { RagController } from "./rag.controller";
import { RagService } from "./rag.service";

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
