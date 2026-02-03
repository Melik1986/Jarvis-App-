import { Module } from "@nestjs/common";
import { RulebookService } from "./rulebook.service";
import { RulebookController } from "./rulebook.controller";

@Module({
  controllers: [RulebookController],
  providers: [RulebookService],
  exports: [RulebookService],
})
export class RulebookModule {}
