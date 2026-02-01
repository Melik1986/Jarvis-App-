import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  NotFoundException,
  ParseIntPipe,
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
import { SendMessageDto, CreateConversationDto } from "./chat.dto";

@ApiTags("conversations")
@Controller("conversations")
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: "List all conversations" })
  @ApiResponse({ status: 200, description: "List of conversations" })
  getAllConversations() {
    return this.chatService.getAllConversations();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get conversation with messages" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Conversation and messages" })
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
  createConversation(@Body() body: CreateConversationDto) {
    return this.chatService.createConversation(body.title || "New Chat");
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete conversation" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Deleted" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  deleteConversation(@Param("id", ParseIntPipe) id: number) {
    const deleted = this.chatService.deleteConversation(id);
    if (!deleted) {
      throw new NotFoundException("Conversation not found");
    }
    return { success: true };
  }

  @Post(":id/messages")
  @ApiOperation({ summary: "Send message (SSE stream)" })
  @ApiParam({ name: "id", type: Number })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 200, description: "SSE stream of response" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async sendMessage(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: SendMessageDto,
    @Res() res: Response,
  ) {
    const conversation = this.chatService.getConversation(id);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    await this.chatService.streamResponse(
      id,
      body.content,
      res,
      body.llmSettings,
      body.erpSettings,
      body.ragSettings,
    );
  }
}
