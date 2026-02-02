import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { createHmac } from "crypto";
import { canonicalStringify } from "../utils/canonical-json";

@Injectable()
export class RequestSignatureGuard implements CanActivate {
  private readonly API_SECRET = process.env.API_SECRET || "";

  canActivate(context: ExecutionContext): boolean {
    // Skip signature validation if API_SECRET is not set (dev mode)
    if (!this.API_SECRET) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers["x-signature"] as string;

    if (!signature) {
      throw new UnauthorizedException("Missing request signature");
    }

    // Use canonical JSON for consistent signature
    const payload = canonicalStringify(request.body);

    const expected = createHmac("sha256", this.API_SECRET)
      .update(payload)
      .digest("hex");

    if (signature !== expected) {
      throw new UnauthorizedException("Request signature invalid");
    }

    return true;
  }
}
