import { Injectable } from "@nestjs/common";
import { RulebookService } from "../modules/rules/rulebook.service";
import { ValidationService } from "../services/validation.service";

export interface GuardianCheckResult {
  allowed: boolean;
  message?: string;
  action: "allow" | "reject" | "warn" | "require_confirmation";
}

@Injectable()
export class GuardianGuard {
  constructor(
    private rulebook: RulebookService,
    private validationService: ValidationService,
  ) {}

  /**
   * Comprehensive check of a tool call before execution.
   */
  async check(
    userId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<GuardianCheckResult> {
    // 1. Rulebook Check (User-defined rules)
    const ruleResult = await this.rulebook.validateToolCall(
      userId,
      toolName,
      args,
    );
    if (!ruleResult.allowed) {
      return {
        allowed: false,
        action: "reject",
        message: ruleResult.message,
      };
    }

    // 2. Semantic Validation (Hardcoded/Complex logic)
    const semanticResult = await this.validationService.validate(
      toolName,
      args,
    );
    if (!semanticResult.valid) {
      return {
        allowed: false,
        action: "reject",
        message: semanticResult.message,
      };
    }

    // 3. Warning Check
    if (semanticResult.level === "warning" && semanticResult.message) {
      return {
        allowed: true,
        action: "require_confirmation",
        message: semanticResult.message,
      };
    }

    if (
      ruleResult.action === "warn" ||
      ruleResult.action === "require_confirmation"
    ) {
      return {
        allowed: true,
        action: ruleResult.action as
          | "allow"
          | "reject"
          | "warn"
          | "require_confirmation",
        message: ruleResult.message,
      };
    }

    return { allowed: true, action: "allow" };
  }
}
