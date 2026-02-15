export interface SkillRunnerRequestMessage {
  id: string;
  code: string;
  input: Record<string, unknown>;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface SkillRunnerSuccessMessage {
  id: string;
  ok: true;
  result: unknown;
}

export interface SkillRunnerErrorMessage {
  id: string;
  ok: false;
  error: string;
}

export type SkillRunnerResponseMessage =
  | SkillRunnerSuccessMessage
  | SkillRunnerErrorMessage;
