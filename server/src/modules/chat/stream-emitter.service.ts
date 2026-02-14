import { Injectable } from "@nestjs/common";
import { Response } from "express";
import { AppLogger } from "../../utils/logger";

export interface StreamEvent {
  [key: string]: unknown;
}

@Injectable()
export class StreamEmitterService {
  /**
   * Write SSE event to response stream.
   * Safely handles already-closed connections.
   */
  emit(res: Response, event: StreamEvent): void {
    try {
      if (!res.closed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      AppLogger.warn("Failed to emit stream event:", error);
    }
  }

  /**
   * Emit text delta (for streaming text responses).
   */
  emitTextDelta(res: Response, delta: string): void {
    this.emit(res, { type: "text-delta", content: delta });
  }

  /**
   * Emit tool call event.
   */
  emitToolCall(
    res: Response,
    toolName: string,
    args: Record<string, unknown>,
  ): void {
    this.emit(res, { type: "tool-call", toolCall: { toolName, args } });
  }

  /**
   * Emit tool result event.
   */
  emitToolResult(
    res: Response,
    toolName: string,
    resultSummary: string,
    confidence: number,
    action: string,
  ): void {
    this.emit(res, {
      type: "tool-result",
      toolResult: {
        toolName,
        resultSummary,
        confidence,
        action,
      },
    });
  }

  /**
   * Emit voice transcript event.
   */
  emitVoiceTranscript(
    res: Response,
    transcript: string,
    type = "transcript",
  ): void {
    this.emit(res, { type, data: transcript });
  }

  /**
   * Emit completion event.
   */
  emitDone(res: Response): void {
    this.emit(res, { type: "done", done: true });
  }

  /**
   * Emit error event.
   */
  emitError(res: Response, error: string): void {
    this.emit(res, { type: "error", error });
  }

  /**
   * Setup SSE headers for response.
   */
  setupSseHeaders(res: Response): void {
    // Voice/chat pipelines can call this more than once in one request.
    // If headers are already sent, touching headers throws ERR_HTTP_HEADERS_SENT.
    if (res.headersSent || res.writableEnded || res.closed) {
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
  }
}
