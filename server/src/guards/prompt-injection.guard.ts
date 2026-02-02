import { Injectable } from "@nestjs/common";

export interface InjectionDetectionResult {
  detected: boolean;
  warning?: string;
  requireManualReview: boolean;
}

@Injectable()
export class PromptInjectionGuard {
  private readonly INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /system prompt/i,
    /jailbreak/i,
    /<\/instructions>/i,
    /forget all previous/i,
    /new instructions/i,
    /override/i,
    /disregard/i,
    /ignore the above/i,
    /you are now/i,
    /pretend to be/i,
    /act as if/i,
  ];

  /**
   * Detects potential prompt injection patterns in user input.
   * Returns detection result with warning if suspicious patterns found.
   */
  detectInjection(userInput: string): InjectionDetectionResult {
    if (!userInput || typeof userInput !== "string") {
      return { detected: false, requireManualReview: false };
    }

    const detected = this.INJECTION_PATTERNS.some((pattern) =>
      pattern.test(userInput),
    );

    if (detected) {
      return {
        detected: true,
        warning:
          "⚠️ Your command contains suspicious patterns. Manual review required.",
        requireManualReview: true,
      };
    }

    return { detected: false, requireManualReview: false };
  }
}
