import * as vm from "vm";
import type {
  SkillRunnerRequestMessage,
  SkillRunnerResponseMessage,
} from "./skill-runner.protocol";

function send(message: SkillRunnerResponseMessage): void {
  if (typeof process.send === "function") {
    process.send(message);
  }
}

async function executeSkill(
  request: SkillRunnerRequestMessage,
): Promise<SkillRunnerResponseMessage> {
  const sandbox: {
    input: Record<string, unknown>;
  } = {
    input: request.input,
  };

  try {
    const wrapped = `
      (async () => {
        let result = null;
        ${request.code}
        return result;
      })()
    `;

    const script = new vm.Script(wrapped);
    vm.createContext(sandbox);
    const execution = script.runInContext(sandbox, {
      timeout: request.timeoutMs,
    }) as Promise<unknown>;

    const result = await execution;
    const serialized = JSON.stringify(result ?? null);
    const outputSize = Buffer.byteLength(serialized, "utf8");
    if (outputSize > request.maxOutputBytes) {
      throw new Error("Skill output exceeded configured size limit");
    }

    return {
      id: request.id,
      ok: true,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: request.id,
      ok: false,
      error: message,
    };
  }
}

process.on("message", async (rawMessage: unknown) => {
  const request = rawMessage as SkillRunnerRequestMessage;
  if (
    !request ||
    typeof request.id !== "string" ||
    typeof request.code !== "string" ||
    typeof request.timeoutMs !== "number" ||
    typeof request.maxOutputBytes !== "number"
  ) {
    send({
      id: "unknown",
      ok: false,
      error: "Invalid skill runner request payload",
    });
    process.exit(1);
  }

  const response = await executeSkill(request);
  send(response);
  process.exit(response.ok ? 0 : 1);
});
