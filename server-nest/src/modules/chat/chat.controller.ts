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
import { Response } from "express";
import { ChatService } from "./chat.service";
import { SendMessageDto, CreateConversationDto } from "./chat.dto";

@Controller("conversations")
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  getAllConversations() {
    return this.chatService.getAllConversations();
  }

  @Get(":id")
  getConversation(@Param("id", ParseIntPipe) id: number) {
    const conversation = this.chatService.getConversation(id);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    const messages = this.chatService.getMessages(id);
    return { ...conversation, messages };
  }

  @Post()
  createConversation(@Body() body: CreateConversationDto) {
    return this.chatService.createConversation(body.title || "New Chat");
  }

  @Delete(":id")
  deleteConversation(@Param("id", ParseIntPipe) id: number) {
    const deleted = this.chatService.deleteConversation(id);
    if (!deleted) {
      throw new NotFoundException("Conversation not found");
    }
    return { success: true };
  }

  @Post(":id/messages")
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
