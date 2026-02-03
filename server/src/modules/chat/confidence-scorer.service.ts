import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfidenceScorerService {
  /**
   * Calculate confidence score for a tool call (0-1).
   */
  calculateConfidence(toolCall: {
    toolName: string;
    args: Record<string, unknown>;
    resultSummary?: string;
    ruleViolation?: boolean;
    ruleAction?: string;
    guardianAction?: "allow" | "reject" | "warn" | "require_confirmation";
  }): number {
    // Base confidence
    let confidence = 0.85;

    // 1. Check for rule violations from Rulebook/Guardian
    const action = toolCall.guardianAction || toolCall.ruleAction;
    if (action) {
      if (action === "reject") return 0;
      if (action === "require_confirmation") confidence -= 0.35;
      if (action === "warn") confidence -= 0.15;
    }

    // 2. Argument validation
    const args = toolCall.args || {};
    const argCount = Object.keys(args).length;

    // Penalize empty or very few arguments for complex tools
    if (toolCall.toolName === "create_invoice" && argCount < 1) {
      confidence -= 0.4;
    }

    // 3. Success indicators in result summary
    if (toolCall.resultSummary) {
      const lowerSummary = toolCall.resultSummary.toLowerCase();
      const successWords = [
        "создан",
        "найдено",
        "успешно",
        "ok",
        "success",
        "created",
      ];
      const failureWords = [
        "не найдено",
        "ошибка",
        "failed",
        "error",
        "not found",
      ];

      if (successWords.some((word) => lowerSummary.includes(word))) {
        confidence += 0.15;
      } else if (failureWords.some((word) => lowerSummary.includes(word))) {
        confidence -= 0.3;
      }
    }

    // 4. Complexity penalty
    if (argCount > 8) confidence -= 0.1;

    // 5. Critical tool penalty (write operations)
    const isWriteOp =
      toolCall.toolName.startsWith("create_") ||
      toolCall.toolName.startsWith("update_") ||
      toolCall.toolName.startsWith("delete_");
    if (isWriteOp) {
      confidence -= 0.1;
    }

    // 6. Verification status (CoVe)
    // If it's a verification tool (read before write), confidence is usually high
    if (
      toolCall.toolName.includes("get_") ||
      toolCall.toolName.includes("list_")
    ) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }
}
