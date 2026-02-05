import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  Req,
  UseGuards,
  NotFoundException,
  ParseIntPipe,
  Inject,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { Response } from "express";
import { ChatService } from "./chat.service";
import {
  SendMessageDto,
  CreateConversationDto,
  VoiceMessageDto,
} from "./chat.dto";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";

@ApiTags("conversations")
@Controller("conversations")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: "List all conversations" })
  @ApiResponse({ status: 200, description: "List of conversations" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  getAllConversations() {
    return this.chatService.getAllConversations();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get conversation with messages" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Conversation and messages" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  getConversation(@Param("id", ParseIntPipe) id: number) {
    const conversation = this.chatService.getConversation(id);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    const messages = this.chatService.getMessages(id);
    return { ...conversation, messages };
  }

  @Post()
  @ApiOperation({ summary: "Create new conversation" })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({ status: 201, description: "Created conversation" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  createConversation(@Body() body: CreateConversationDto) {
    return this.chatService.createConversation(body.title || "New Chat");
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete conversation" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Deleted" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  deleteConversation(@Param("id", ParseIntPipe) id: number) {
    const deleted = this.chatService.deleteConversation(id);
    if (!deleted) {
      throw new NotFoundException("Conversation not found");
    }
    return { success: true };
  }

  @Post(":id/messages")
  @UseGuards(AuthGuard, RateLimitGuard)
  @ApiOperation({ summary: "Send message (SSE stream)" })
  @ApiParam({ name: "id", type: Number })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 200, description: "SSE stream of response" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async sendMessage(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: SendMessageDto,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest,
  ) {
    const conversation = this.chatService.getConversation(id);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    // Merge ephemeralCredentials with body settings (ephemeralCredentials take priority)
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
      id,
      body.content,
      res,
      llmSettings,
      body.erpSettings,
      body.ragSettings,
      body.attachments,
    );
  }
}

@ApiTags("conversations")
@Controller("voice")
export class VoiceController {
  constructor(@Inject(ChatService) private chatService: ChatService) {}

  @Post(":id/message")
  @UseGuards(AuthGuard, RateLimitGuard)
  @ApiOperation({ summary: "Send voice message (SSE stream)" })
  @ApiParam({ name: "id", type: Number })
  @ApiBody({ type: VoiceMessageDto })
  @ApiResponse({ status: 200, description: "SSE stream of response" })
  @ApiResponse({ status: 400, description: "Invalid audio" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async sendVoiceMessage(
    @Param("id", ParseIntPipe) id: number,
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
      id,
      body.audio,
      res,
      llmSettings,
      body.erpSettings,
      body.ragSettings,
      body.transcriptionModel,
    );
  }
}
