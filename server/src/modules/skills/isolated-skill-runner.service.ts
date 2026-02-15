import { Injectable } from "@nestjs/common";
import { fork } from "child_process";
import { randomUUID } from "crypto";
import * as path from "path";
import { AppLogger } from "../../utils/logger";
import type {
  SkillRunnerRequestMessage,
  SkillRunnerResponseMessage,
} from "./skill-runner.protocol";

@Injectable()
export class IsolatedSkillRunnerService {
  private readonly runtimeMode =
    process.env.SKILL_RUNTIME_MODE?.toLowerCase() || "isolated";
  private readonly timeoutMs = Number(
    process.env.SKILL_WORKER_TIMEOUT_MS || "1500",
  );
  private readonly memoryMb = Number(
    process.env.SKILL_WORKER_MEMORY_MB || "64",
  );
  private readonly maxOutputBytes = Number(
    process.env.SKILL_WORKER_MAX_OUTPUT_BYTES || "131072",
  );
  private readonly denylist = [
    "require",
    "process",
    "child_process",
    "fs",
    "net",
    "http",
    "https",
    "vm",
    "eval",
    "Function",
    "import(",
  ];

  async execute(
    code: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.runtimeMode === "off") {
      throw new Error("Skill runtime is disabled by policy");
    }
    if (this.runtimeMode !== "isolated") {
      throw new Error(`Unsupported skill runtime mode: ${this.runtimeMode}`);
    }

    this.assertCodeAllowed(code);
    return this.executeInWorker(code, input);
  }

  private assertCodeAllowed(code: string): void {
    for (const token of this.denylist) {
      if (code.includes(token)) {
        throw new Error(`Skill code contains blocked token: ${token}`);
      }
    }
  }

  private executeInWorker(
    code: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const childPath = this.resolveWorkerScriptPath();
    const requestId = randomUUID();

    return new Promise<unknown>((resolve, reject) => {
      const execArgv = [
        ...process.execArgv.filter(
          (arg) => !arg.startsWith("--max-old-space-size"),
        ),
        `--max-old-space-size=${this.memoryMb}`,
      ];
      const child = fork(childPath, [], {
        env: this.buildWorkerEnv(),
        execArgv,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });

      let completed = false;
      let outputBytes = 0;

      const complete = (fn: () => void) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        try {
          child.kill();
        } catch {
          // no-op
        }
        fn();
      };

      const trackOutputSize = (chunk: Buffer) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > this.maxOutputBytes) {
          complete(() =>
            reject(new Error("Skill worker output exceeded configured limit")),
          );
        }
      };

      child.stdout?.on("data", (chunk: Buffer) => trackOutputSize(chunk));
      child.stderr?.on("data", (chunk: Buffer) => trackOutputSize(chunk));

      child.once("error", (error) => {
        complete(() => reject(error));
      });

      child.on("message", (message: SkillRunnerResponseMessage) => {
        if (!message || message.id !== requestId) {
          return;
        }
        if (message.ok) {
          complete(() => resolve(message.result));
        } else {
          complete(() => reject(new Error(message.error)));
        }
      });

      child.once("exit", (code, signal) => {
        if (completed) return;
        complete(() =>
          reject(
            new Error(
              `Skill worker exited before response (code=${code ?? "null"}, signal=${signal ?? "null"})`,
            ),
          ),
        );
      });

      const timer = setTimeout(() => {
        AppLogger.warn("Skill worker timeout reached; terminating");
        complete(() => reject(new Error("Skill execution timed out")));
      }, this.timeoutMs);

      const request: SkillRunnerRequestMessage = {
        id: requestId,
        code,
        input,
        timeoutMs: this.timeoutMs,
        maxOutputBytes: this.maxOutputBytes,
      };
      child.send(request);
    });
  }

  private resolveWorkerScriptPath(): string {
    const runtimeExt = path.extname(__filename).toLowerCase();
    const childExt = runtimeExt === ".ts" ? ".ts" : ".js";
    return path.resolve(__dirname, `skill-runner.child${childExt}`);
  }

  private buildWorkerEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: process.env.NODE_ENV || "development",
      TZ: process.env.TZ || "UTC",
    };
    return env;
  }
}
