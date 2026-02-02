import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { Request } from "express";
import { ChatService } from "../chat/chat.service";
import { ConductorParseDto } from "./conductor.dto";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthGuard } from "../auth/auth.guard";

interface ExtendedRequest extends Request {
  ephemeralCredentials?: {
    llmKey?: string;
    llmProvider?: string;
    llmBaseUrl?: string;
  };
}

@ApiTags("conversations")
@Controller("conductor")
export class ConductorController {
  constructor(private chatService: ChatService) {}

  @Post("parse")
  @UseGuards(AuthGuard, RateLimitGuard)
  @ApiOperation({
    summary: "Parse raw text (Conductor) — no streaming",
    description:
      "Send raw text (e.g. from Whisper: «три колы и один пирожок») and get structured tool calls and assistant text. For Swagger/testing.",
  })
  @ApiBody({ type: ConductorParseDto })
  @ApiResponse({
    status: 200,
    description: "Parsed result with toolCalls and assistantText",
    schema: {
      type: "object",
      properties: {
        rawText: { type: "string" },
        toolCalls: {
          type: "array",
          items: {
            type: "object",
            properties: {
              toolName: { type: "string" },
              args: {},
              resultSummary: { type: "string" },
            },
          },
        },
        assistantText: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async parse(@Body() body: ConductorParseDto, @Req() req: ExtendedRequest) {
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

    return this.chatService.parseRawText(
      body.rawText,
      llmSettings,
      body.erpSettings,
      body.ragSettings,
    );
  }
}
