import { Module } from "@nestjs/common";
import { SkillService } from "./skill.service";
import { SandboxExecutorService } from "./sandbox-executor.service";
import { IsolatedSkillRunnerService } from "./isolated-skill-runner.service";

@Module({
  providers: [SkillService, SandboxExecutorService, IsolatedSkillRunnerService],
  exports: [SkillService, SandboxExecutorService, IsolatedSkillRunnerService],
})
export class SkillsModule {}
