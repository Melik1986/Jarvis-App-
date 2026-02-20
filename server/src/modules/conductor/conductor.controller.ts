import { Controller, Post, Body, UseGuards, Req, Inject } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { ChatService } from "../chat/chat.service";
import { ConductorParseDto } from "./conductor.dto";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { RequestSignatureGuard } from "../../guards/request-signature.guard";

@ApiTags("conversations")
@Controller("conductor")
export class ConductorController {
  constructor(@Inject(ChatService) private chatService: ChatService) {}

  @Post("parse")
  @UseGuards(AuthGuard, RateLimitGuard, RequestSignatureGuard)
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
  async parse(
    @Body() body: ConductorParseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // Merge ephemeralCredentials with body settings (ephemeralCredentials take priority)
    const credentials = req.ephemeralCredentials;
    const llmSettings = {
      ...body.llmSettings,
      ...(credentials?.llmKey && { apiKey: credentials.llmKey }),
      ...(credentials?.llmProvider && {
        provider: credentials.llmProvider as
          | "openai"
          | "google"
          | "groq"
          | "ollama"
          | "replit"
          | "custom",
      }),
      ...(credentials?.llmBaseUrl && { baseUrl: credentials.llmBaseUrl }),
    } as typeof body.llmSettings;

    return this.chatService.parseRawText(
      req.user.id,
      body.rawText,
      llmSettings,
      body.erpSettings,
      body.ragSettings,
    );
  }
}
