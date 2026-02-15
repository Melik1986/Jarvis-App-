import { Injectable } from "@nestjs/common";
import { AppLogger } from "../../utils/logger";
import { IsolatedSkillRunnerService } from "./isolated-skill-runner.service";

@Injectable()
export class SandboxExecutorService {
  constructor(private readonly isolatedRunner: IsolatedSkillRunnerService) {}

  /**
   * Execute JavaScript code in isolated worker runtime.
   */
  async execute(
    code: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      AppLogger.info(
        "Executing skill in isolated worker",
        undefined,
        "Sandbox",
      );
      return await this.isolatedRunner.execute(code, input);
    } catch (error) {
      AppLogger.error(
        "Skill execution failed in isolated runtime",
        error,
        "Sandbox",
      );
      throw error;
    }
  }
}
