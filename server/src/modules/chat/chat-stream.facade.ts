import { Injectable, Inject } from "@nestjs/common";
import {
  ChatStreamContext,
  ChatStreamOrchestrator,
} from "./chat-stream.orchestrator";
import {
  VoiceStreamContext,
  VoiceStreamOrchestrator,
} from "./voice-stream.orchestrator";

@Injectable()
export class ChatStreamFacade {
  constructor(
    @Inject(ChatStreamOrchestrator)
    private readonly chatStreamOrchestrator: ChatStreamOrchestrator,
    @Inject(VoiceStreamOrchestrator)
    private readonly voiceStreamOrchestrator: VoiceStreamOrchestrator,
  ) {}

  async streamChat(context: ChatStreamContext): Promise<void> {
    await this.chatStreamOrchestrator.streamChatResponse(context);
  }

  async streamVoice(context: VoiceStreamContext): Promise<void> {
    await this.voiceStreamOrchestrator.streamVoiceResponse(context);
  }
}
