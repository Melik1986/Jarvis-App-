import { type Tool } from "ai";
import { VerificationPipeline } from "./verification-pipeline.service";
import { CoveWorkflowService } from "./cove-workflow.service";
import { ToolRegistryService } from "./tool-registry.service";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { DiffPreviewService } from "./diff-preview.service";

describe("VerificationPipeline", () => {
  let service: VerificationPipeline;
  let coveWorkflow: jest.Mocked<CoveWorkflowService>;
  let toolRegistry: jest.Mocked<ToolRegistryService>;

  beforeEach(async () => {
    const mockCoveWorkflow: jest.Mocked<CoveWorkflowService> = {
      needsVerification: jest.fn().mockReturnValue(true),
      getVerificationTools: jest
        .fn()
        .mockReturnValue([
          { toolName: "get_stock", args: { product_name: "Widget" } },
        ]),
    };

    const mockToolRegistry = {
      getTools: jest.fn().mockResolvedValue({
        get_stock: {
          description: "Get stock information",
          inputSchema: { type: "object", properties: {} },
          execute: jest.fn().mockResolvedValue("Widget: 50 units in stock"),
        } as unknown as Tool<unknown, unknown>,
        create_invoice: {
          description: "Create an invoice",
          inputSchema: { type: "object", properties: {} },
          execute: jest.fn().mockResolvedValue("Invoice created"),
        } as unknown as Tool<unknown, unknown>,
      }),
    } as unknown as jest.Mocked<ToolRegistryService>;

    const mockConfidenceScorer: jest.Mocked<ConfidenceScorerService> = {
      calculateConfidence: jest.fn().mockReturnValue(0.87),
    };

    const mockDiffPreview = {
      generateDiffPreview: jest.fn().mockReturnValue({
        before: { status: "Not created" },
        after: { status: "Created" },
      }),
      previewCreateInvoice: jest.fn(),
      previewGetStock: jest.fn(),
      previewUpdateProduct: jest.fn(),
      previewDeleteDocument: jest.fn(),
    } as unknown as jest.Mocked<DiffPreviewService>;

    service = new VerificationPipeline(
      mockCoveWorkflow,
      mockToolRegistry,
      mockConfidenceScorer,
      mockDiffPreview,
    );
    coveWorkflow = mockCoveWorkflow;
    toolRegistry = mockToolRegistry;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("processTool", () => {
    it("should process tool call with verification", async () => {
      const toolCall = {
        toolCallId: "tc-1",
        toolName: "create_invoice",
        args: { items: [{ product_name: "Widget", quantity: 10 }] },
        resultSummary: "",
      };

      const result = await service.processTool(toolCall, "user-123", {});

      // Should have verification + main tool call
      expect(result).toHaveLength(2);
      expect(result[0].toolName).toBe("get_stock");
      expect(result[0].isVerification).toBe(true);
      expect(result[0].resultSummary).toBe("Widget: 50 units in stock");

      expect(result[1].toolName).toBe("create_invoice");
      expect(result[1].isVerification).toBeUndefined();
      expect(result[1].confidence).toBe(0.87);
    });

    it("should skip verification if not needed", async () => {
      coveWorkflow.needsVerification.mockReturnValue(false);

      const toolCall = {
        toolCallId: "tc-2",
        toolName: "get_stock",
        args: { product_name: "Widget" },
        resultSummary: "",
      };

      const result = await service.processTool(toolCall, "user-123", {});

      // Should have only main tool call
      expect(result).toHaveLength(1);
      expect(result[0].toolName).toBe("get_stock");
      expect(result[0].isVerification).toBeUndefined();
    });

    it("should include diff preview for main tool call", async () => {
      coveWorkflow.needsVerification.mockReturnValue(false);

      const toolCall = {
        toolCallId: "tc-3",
        toolName: "create_invoice",
        args: { items: [] },
        resultSummary: "",
      };

      const result = await service.processTool(toolCall, "user-123", {});

      expect(result[0].diffPreview).toBeDefined();
      expect(result[0].diffPreview?.before.status).toBe("Not created");
    });

    it("should set confidence to 1.0 for verification tools", async () => {
      const toolCall = {
        toolCallId: "tc-4",
        toolName: "create_invoice",
        args: {},
        resultSummary: "",
      };

      const result = await service.processTool(toolCall, "user-123", {});

      const verificationTool = result.find((t) => t.isVerification);
      expect(verificationTool?.confidence).toBe(1.0);
    });
  });

  describe("processTools", () => {
    it("should process multiple tool calls", async () => {
      const toolCalls = [
        {
          toolCallId: "tc-1",
          toolName: "create_invoice",
          args: {},
          resultSummary: "",
        },
        {
          toolCallId: "tc-2",
          toolName: "get_stock",
          args: { product_name: "Widget" },
          resultSummary: "",
        },
      ];

      const result = await service.processTools(toolCalls, "user-123", {});

      // First tool: verification + main (2 items)
      // Second tool: no verification, just main (1 item)
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle empty tool call array", async () => {
      const result = await service.processTools([], "user-123", {});

      expect(result).toEqual([]);
    });
  });

  describe("executeVerificationTool", () => {
    it("should handle tool execution errors gracefully", async () => {
      toolRegistry.getTools.mockResolvedValue({
        failing_tool: {
          description: "Failing tool",
          inputSchema: { type: "object", properties: {} },
          execute: jest
            .fn()
            .mockRejectedValue(new Error("Tool execution failed")),
        } as unknown as Tool<unknown, unknown>,
      });

      const toolCall = {
        toolCallId: "tc-5",
        toolName: "failing_tool",
        args: {},
        resultSummary: "",
      };

      coveWorkflow.getVerificationTools.mockReturnValue([
        { toolName: "failing_tool", args: {} },
      ]);

      const result = await service.processTool(toolCall, "user-123", {});

      const verificationResult = result[0];
      expect(verificationResult.resultSummary).toContain("Verification failed");
    });
  });
});
