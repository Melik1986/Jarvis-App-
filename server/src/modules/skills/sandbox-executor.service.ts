import { Injectable } from "@nestjs/common";
import * as vm from "vm";
import { AppLogger } from "../../utils/logger";

@Injectable()
export class SandboxExecutorService {
  /**
   * Execute JavaScript code in a safe sandbox.
   */
  async execute(
    code: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const context: {
      input: Record<string, unknown>;
      console: {
        log: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
      };
      result: unknown;
    } = {
      input,
      console: {
        log: (...args: unknown[]) =>
          AppLogger.info(`[Sandbox] ${args.join(" ")}`, undefined, "Sandbox"),
        error: (...args: unknown[]) =>
          AppLogger.error(`[Sandbox] ${args.join(" ")}`, undefined, "Sandbox"),
      },
      result: null,
    };

    try {
      AppLogger.info("Executing skill in sandbox", undefined, "Sandbox");

      const script = new vm.Script(`
        (async () => {
          ${code}
          // The script should set 'result' variable
        })()
      `);

      vm.createContext(context);

      // Run with 1 second timeout
      await script.runInContext(context, { timeout: 1000 });

      return context.result;
    } catch (error) {
      AppLogger.error("Skill execution failed in sandbox", error, "Sandbox");
      throw error;
    }
  }
}
