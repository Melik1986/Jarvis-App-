import { Injectable } from "@nestjs/common";
import { ChatStreamContext } from "./chat-stream.orchestrator";
import { VoiceStreamContext } from "./voice-stream.orchestrator";

@Injectable()
export class ChatRequestContextFactory {
  createChatContext(context: ChatStreamContext): ChatStreamContext {
    return context;
  }

  createVoiceContext(context: VoiceStreamContext): VoiceStreamContext {
    return context;
  }
}
