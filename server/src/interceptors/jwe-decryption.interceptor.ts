import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Request } from "express";
import { jwtDecrypt, importPKCS8 } from "jose";
import { SERVER_PRIVATE_KEY } from "../config/jwk.config";
import { TokenExchangeService } from "../services/token-exchange.service";
import { AppLogger } from "../utils/logger";

interface EphemeralCredentials {
  llmKey: string;
  llmProvider: string;
  llmBaseUrl?: string;
  dbUrl?: string;
  dbKey?: string;
  erpUrl?: string;
  erpType?: string;
}

interface ExtendedRequest extends Request {
  ephemeralCredentials?: EphemeralCredentials;
  sessionToken?: string;
}

@Injectable()
export class JweDecryptionInterceptor implements NestInterceptor {
  constructor(private tokenExchangeService: TokenExchangeService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();

    // Check for session token first (for subsequent requests)
    const sessionToken = request.headers["x-session-token"] as string;
    if (sessionToken) {
      const credentials =
        this.tokenExchangeService.getCredentials(sessionToken);
      if (credentials) {
        request.ephemeralCredentials = credentials;
        request.sessionToken = sessionToken;
        return next.handle();
      }
      // Session token expired or invalid, try JWE token
    }

    // Check for JWE token (initial request)
    const jweToken = request.headers["x-encrypted-config"] as string;
    if (jweToken) {
      try {
        const privateKey = await importPKCS8(
          SERVER_PRIVATE_KEY,
          "ECDH-ES+HKDF-256",
        );
        const { payload } = await jwtDecrypt(jweToken, privateKey);

        // Extract credentials from payload
        const credentials: EphemeralCredentials = {
          llmKey: payload.llmKey as string,
          llmProvider: payload.llmProvider as string,
          llmBaseUrl: payload.llmBaseUrl as string | undefined,
          dbUrl: payload.dbUrl as string | undefined,
          dbKey: payload.dbKey as string | undefined,
          erpUrl: payload.erpUrl as string | undefined,
          erpType: payload.erpType as string | undefined,
        };

        // Validate required fields
        if (!credentials.llmKey || !credentials.llmProvider) {
          throw new UnauthorizedException(
            "Missing required credentials in JWE token",
          );
        }

        // Create session token for subsequent requests
        const newSessionToken =
          await this.tokenExchangeService.createSessionToken(credentials);

        request.ephemeralCredentials = credentials;
        request.sessionToken = newSessionToken;

        AppLogger.debug(
          `Decrypted JWE token and created session: ${newSessionToken.slice(0, 8)}...`,
        );
      } catch (error) {
        AppLogger.warn("JWE decryption failed:", error);
        throw new UnauthorizedException("JWE decryption failed");
      }
    }

    return next.handle();
  }
}
