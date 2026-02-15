import { Injectable, Inject } from "@nestjs/common";
import { PromptInjectionGuard } from "../../guards/prompt-injection.guard";

@Injectable()
export class ChatSecurityService {
  constructor(
    @Inject(PromptInjectionGuard)
    private readonly promptInjectionGuard: PromptInjectionGuard,
  ) {}

  checkPrompt(text: string) {
    return this.promptInjectionGuard.detectInjection(text);
  }
}
