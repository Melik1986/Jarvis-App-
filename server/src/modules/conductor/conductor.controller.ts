import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { ChatService } from "../chat/chat.service";
import { ConductorParseDto } from "./conductor.dto";

@ApiTags("conversations")
@Controller("conductor")
export class ConductorController {
  constructor(private chatService: ChatService) {}

  @Post("parse")
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
  @ApiResponse({ status: 502, description: "LLM provider error" })
  async parse(@Body() body: ConductorParseDto) {
    return this.chatService.parseRawText(
      body.rawText,
      body.llmSettings,
      body.erpSettings,
      body.ragSettings,
    );
  }
}
