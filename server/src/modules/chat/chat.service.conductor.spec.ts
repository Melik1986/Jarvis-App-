/**
 * Integration tests for ChatService.parseRawText (Conductor).
 * Excluded from default run (jest.config.js testPathIgnorePatterns: "conductor")
 * due to hang in module setup when mocking "ai" + loading ChatService.
 * Run manually when debugging: npx jest server/src/modules/chat/chat.service.conductor.spec.ts
 */
import { Test, TestingModule } from "@nestjs/testing";
import { ChatService } from "./chat.service";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { ErpService } from "../erp/erp.service";

async function* mockFullStreamWithToolCall() {
  yield {
    type: "tool-call",
    toolCallId: "tc-1",
    toolName: "get_products",
    input: { filter: "кола" },
  };
  yield {
    type: "tool-result",
    toolCallId: "tc-1",
    toolName: "get_products",
    output: [{ name: "Кола", price: 50 }],
  };
  yield { type: "text-delta", text: "Вот результаты." };
}

async function* mockFullStreamTextOnly() {
  yield { type: "text-delta", text: "Привет." };
  yield { type: "text-delta", text: " Чем помочь?" };
}

jest.mock("ai", () => ({
  streamText: jest.fn(),
  tool: jest.fn(),
}));

describe("ChatService (Conductor parseRawText)", () => {
  let service: ChatService;

  jest.setTimeout(15000);

  beforeEach(async () => {
    const ai = await import("ai");
    const streamTextMock = (ai as unknown as { streamText: jest.Mock })
      .streamText;
    streamTextMock.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: LlmService,
          useValue: { getModel: jest.fn().mockReturnValue("gpt-5.2") },
        },
        {
          provide: RagService,
          useValue: {
            search: jest.fn().mockResolvedValue([]),
            buildContext: jest.fn().mockReturnValue(""),
          },
        },
        {
          provide: ErpService,
          useValue: {
            getStock: jest.fn().mockResolvedValue([]),
            getProducts: jest.fn().mockResolvedValue([]),
            createInvoice: jest.fn().mockResolvedValue({ id: "1" }),
          },
        },
      ],
    }).compile();
    service = module.get<ChatService>(ChatService);
  });

  it("returns rawText, toolCalls with args/resultSummary, and assistantText when stream has tool-call and tool-result", async () => {
    const ai = await import("ai");
    const streamTextMock = (ai as unknown as { streamText: jest.Mock })
      .streamText;
    streamTextMock.mockReturnValue({
      fullStream: mockFullStreamWithToolCall(),
    } as { fullStream: AsyncIterable<unknown> });

    const rawText = "три колы и один пирожок";
    const result = await service.parseRawText("test-user-id", rawText);

    expect(result.rawText).toBe(rawText);
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
    const first = result.toolCalls[0];
    expect(first.toolName).toBe("get_products");
    expect(first.args).toEqual({ filter: "кола" });
    expect(first.resultSummary).not.toBe("");
    expect(result.assistantText).toBe("Вот результаты.");
  });

  it("returns empty toolCalls and non-empty assistantText when stream has only text-delta", async () => {
    const ai = await import("ai");
    const streamTextMock = (ai as unknown as { streamText: jest.Mock })
      .streamText;
    streamTextMock.mockReturnValue({
      fullStream: mockFullStreamTextOnly(),
    } as { fullStream: AsyncIterable<unknown> });

    const rawText = "привет";
    const result = await service.parseRawText("test-user-id", rawText);

    expect(result.rawText).toBe(rawText);
    expect(result.toolCalls).toHaveLength(0);
    expect(result.assistantText).toBe("Привет. Чем помочь?");
  });
});
