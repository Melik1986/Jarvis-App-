import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { Response } from "express";
import { ChatService } from "./chat.service";
import { ChatRequestDto, VoiceMessageDto } from "./chat.dto";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";

@ApiTags("chat")
@Controller("chat")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private chatService: ChatService) {}

  /**
   * Stateless chat endpoint.
   * Client sends everything: message, history, rules, skills, settings.
   * Server processes, streams response, stores nothing.
   */
  @Post()
  @UseGuards(AuthGuard, RateLimitGuard)
  @ApiOperation({ summary: "Send message (stateless SSE stream)" })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({ status: 200, description: "SSE stream of response" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async chat(
    @Body() body: ChatRequestDto,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest,
  ) {
    // Merge ephemeralCredentials with body settings
    const credentials = req.ephemeralCredentials;
    const llmSettings = {
      ...body.llmSettings,
      ...(credentials?.llmKey && { apiKey: credentials.llmKey }),
      ...(credentials?.llmProvider && {
        provider: credentials.llmProvider as
          | "openai"
          | "groq"
          | "ollama"
          | "replit"
          | "custom",
      }),
      ...(credentials?.llmBaseUrl && { baseUrl: credentials.llmBaseUrl }),
    } as typeof body.llmSettings;

    await this.chatService.streamResponse(
      req.user.id,
      body.content,
      res,
      llmSettings,
      body.erpSettings,
      body.ragSettings,
      body.attachments,
      body.history,
      body.mcpServers,
      body.rules,
      body.skills,
      body.conversationSummary,
      body.memoryFacts,
    );
  }
}

@ApiTags("voice")
@Controller("voice")
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(@Inject(ChatService) private chatService: ChatService) {}

  @Post("message")
  @UseGuards(AuthGuard, RateLimitGuard)
  @ApiOperation({ summary: "Send voice message (stateless SSE stream)" })
  @ApiBody({ type: VoiceMessageDto })
  @ApiResponse({ status: 200, description: "SSE stream of response" })
  @ApiResponse({ status: 400, description: "Invalid audio" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async sendVoiceMessage(
    @Body() body: VoiceMessageDto,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest,
  ) {
    const credentials = req.ephemeralCredentials;
    const llmSettings = {
      ...body.llmSettings,
      ...(credentials?.llmKey && { apiKey: credentials.llmKey }),
      ...(credentials?.llmProvider && {
        provider: credentials.llmProvider as
          | "openai"
          | "groq"
          | "ollama"
          | "replit"
          | "custom",
      }),
      ...(credentials?.llmBaseUrl && { baseUrl: credentials.llmBaseUrl }),
    } as typeof body.llmSettings;

    await this.chatService.streamVoiceResponse(
      req.user.id,
      body.audio,
      res,
      llmSettings,
      body.erpSettings,
      body.ragSettings,
      body.transcriptionModel,
    );
  }
}
