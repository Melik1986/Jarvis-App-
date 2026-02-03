import { Module } from "@nestjs/common";
import { SkillService } from "./skill.service";
import { SkillController } from "./skill.controller";
import { SandboxExecutorService } from "./sandbox-executor.service";

@Module({
  controllers: [SkillController],
  providers: [SkillService, SandboxExecutorService],
  exports: [SkillService],
})
export class SkillsModule {}
