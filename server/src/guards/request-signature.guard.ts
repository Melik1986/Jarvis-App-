import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import {
  REQUEST_SIGNATURE_ALGORITHM,
  REQUEST_SIGNATURE_HEADERS,
  buildCanonicalSignaturePayload,
} from "@shared/security/request-signature";

@Injectable()
export class RequestSignatureGuard implements CanActivate {
  private readonly enforce = process.env.REQUEST_SIGNATURE_ENFORCE !== "false";
  private readonly maxSkewMs = Number(
    process.env.REQUEST_SIGNATURE_MAX_SKEW_MS || "60000",
  );
  private readonly nonceTtlMs = this.maxSkewMs;
  private readonly usedNonces = new Map<string, number>();

  canActivate(context: ExecutionContext): boolean {
    if (!this.enforce) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const signature = this.getHeaderValue(
      request,
      REQUEST_SIGNATURE_HEADERS.signature,
    );
    const timestampHeader = this.getHeaderValue(
      request,
      REQUEST_SIGNATURE_HEADERS.timestamp,
    );
    const nonce = this.getHeaderValue(request, REQUEST_SIGNATURE_HEADERS.nonce);
    const algorithm = this.getHeaderValue(
      request,
      REQUEST_SIGNATURE_HEADERS.algorithm,
    );
    const accessToken = this.getAccessToken(request);

    if (!signature || !timestampHeader || !nonce || !algorithm) {
      throw new UnauthorizedException("Missing request signature headers");
    }

    if (algorithm !== REQUEST_SIGNATURE_ALGORITHM) {
      throw new UnauthorizedException(
        "Unsupported request signature algorithm",
      );
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      throw new UnauthorizedException("Invalid request signature timestamp");
    }

    const now = Date.now();
    const skew = Math.abs(now - timestamp);
    if (skew > this.maxSkewMs) {
      throw new UnauthorizedException("Request signature expired");
    }

    this.cleanupExpiredNonces(now);
    const nonceKey = this.buildNonceKey(accessToken, nonce);
    if (this.usedNonces.has(nonceKey)) {
      throw new UnauthorizedException("Replay request detected");
    }

    const canonical = buildCanonicalSignaturePayload({
      method: request.method,
      path: request.originalUrl || request.url || "/",
      timestamp: timestampHeader,
      nonce,
      body: request.body ?? {},
    });
    const expected = createHmac("sha256", accessToken)
      .update(canonical)
      .digest("hex");

    if (!this.constantTimeHexEquals(signature, expected)) {
      throw new UnauthorizedException("Request signature invalid");
    }

    this.usedNonces.set(nonceKey, now + this.nonceTtlMs);
    return true;
  }

  private getHeaderValue(request: Request, headerName: string): string {
    const value =
      request.headers[headerName] ?? request.headers[headerName.toLowerCase()];
    if (Array.isArray(value)) return value[0] || "";
    return typeof value === "string" ? value.trim() : "";
  }

  private getAccessToken(request: Request): string {
    const authHeader = this.getHeaderValue(request, "authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token for signature");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing bearer token for signature");
    }
    return token;
  }

  private constantTimeHexEquals(left: string, right: string): boolean {
    if (!/^[0-9a-fA-F]+$/.test(left) || !/^[0-9a-fA-F]+$/.test(right)) {
      return false;
    }
    const leftBuf = Buffer.from(left.toLowerCase(), "hex");
    const rightBuf = Buffer.from(right.toLowerCase(), "hex");
    if (leftBuf.length !== rightBuf.length) {
      return false;
    }
    return timingSafeEqual(leftBuf, rightBuf);
  }

  private buildNonceKey(accessToken: string, nonce: string): string {
    const tokenPrefix = accessToken.slice(0, 32);
    return `${tokenPrefix}:${nonce}`;
  }

  private cleanupExpiredNonces(now: number): void {
    for (const [key, expiresAt] of this.usedNonces.entries()) {
      if (expiresAt <= now) {
        this.usedNonces.delete(key);
      }
    }
  }
}
