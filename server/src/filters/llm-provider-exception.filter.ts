import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { AppLogger } from "../utils/logger";

export const LLM_PROVIDER_ERROR_CODE = "LLM_PROVIDER_ERROR";
export const LLM_PROVIDER_USER_MESSAGE =
  "LLM Provider unavailable, check API key settings";

/**
 * Detects if the error is related to LLM provider (OpenAI, Groq, etc.)
 */
export function isLlmProviderError(exception: unknown): boolean {
  if (!exception || typeof exception !== "object") return false;

  const err = exception as Record<string, unknown>;
  const message = String(err.message ?? err.msg ?? "").toLowerCase();
  const name = String(err.name ?? "").toLowerCase();

  // OpenAI SDK / fetch status codes
  const status = err.status as number | undefined;
  if (
    status === 401 ||
    status === 403 ||
    status === 429 ||
    status === 502 ||
    status === 503
  ) {
    return true;
  }

  // Common LLM/API error keywords
  const llmKeywords = [
    "openai",
    "api key",
    "invalid_api_key",
    "incorrect api key",
    "authentication",
    "unauthorized",
    "rate limit",
    "insufficient_quota",
    "quota",
    "billing",
    "context_length",
    "maximum context",
    "econnrefused",
    "enotfound",
    "fetch failed",
    "network",
    "timeout",
    "connection refused",
  ];
  const combined = `${message} ${name}`;
  if (llmKeywords.some((k) => combined.includes(k))) return true;

  // Node fetch / TypeError for network
  if (name === "typeerror" && message.includes("fetch")) return true;
  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND"))
    return true;

  return false;
}

/**
 * Extracts safe detail string for client (no secrets).
 */
export function getSafeDetails(exception: unknown): string | undefined {
  if (!exception || typeof exception !== "object") return undefined;
  const err = exception as Record<string, unknown>;
  const status = err.status as number | undefined;
  const msg = String(err.message ?? "")
    .trim()
    .toLowerCase();

  // Context length exceeded
  if (msg.includes("context_length") || msg.includes("maximum context")) {
    return "Input too long — try a shorter message or remove attachments";
  }

  // Quota / billing exhaustion (OpenAI, Groq, etc.)
  if (
    msg.includes("insufficient_quota") ||
    msg.includes("quota") ||
    msg.includes("billing")
  ) {
    return "Quota exceeded — check your billing at provider dashboard";
  }

  if (status === 401) return "Invalid API key";
  if (status === 429) return "Rate limit exceeded — try again later";
  if (status === 502 || status === 503)
    return "Provider temporarily unavailable";
  if (msg.length > 0 && msg.length < 120 && !/sk-[a-zA-Z0-9]/i.test(msg))
    return msg;
  return undefined;
}

/**
 * Returns JSON body for LLM provider errors (for use in controllers that catch errors).
 */
export function getLlmProviderErrorBody(exception: unknown): {
  statusCode: number;
  message: string;
  code: string;
  details?: string;
} {
  const details = getSafeDetails(exception);
  return {
    statusCode: HttpStatus.BAD_GATEWAY,
    message: LLM_PROVIDER_USER_MESSAGE,
    code: LLM_PROVIDER_ERROR_CODE,
    ...(details && { details }),
  };
}

@Catch()
export class LlmProviderExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LlmProviderExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Log full error on server for debugging
    AppLogger.error("Unhandled exception", exception, "LlmProviderFilter");

    const isLlm = isLlmProviderError(exception);

    if (isLlm) {
      const body = getLlmProviderErrorBody(exception);
      if (!res.headersSent) {
        res.status(body.statusCode).json(body);
      }
      return;
    }

    // Non-LLM: preserve NestJS HttpException status (getStatus()), then statusCode, else 500
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === "string"
          ? response
          : ((response as { message?: string })?.message ?? exception.message);
    } else {
      const err = exception as { statusCode?: number; message?: string };
      if (typeof err?.statusCode === "number") statusCode = err.statusCode;
      if (typeof err?.message === "string") message = err.message;
    }
    if (!res.headersSent) {
      res.status(statusCode).json({ statusCode, message });
    }
  }
}
