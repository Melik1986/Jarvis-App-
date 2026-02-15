import {
  Injectable,
  Inject,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Request } from "express";
import { decodeProtectedHeader, jwtDecrypt, importPKCS8 } from "jose";
import { createHash } from "crypto";
import {
  JWE_KEY_ALGORITHM,
  JWE_KEY_ALGORITHMS,
  SERVER_PRIVATE_KEY,
} from "../config/jwk.config";
import { TokenExchangeService } from "../services/token-exchange.service";
import { AppLogger } from "../utils/logger";
import { EphemeralCredentials } from "../modules/auth/auth.types";

interface ExtendedRequest extends Request {
  user?: { id?: string };
  ephemeralCredentials?: EphemeralCredentials;
  sessionToken?: string;
}

@Injectable()
export class JweDecryptionInterceptor implements NestInterceptor {
  constructor(
    @Inject(TokenExchangeService)
    private tokenExchangeService: TokenExchangeService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const response = context.switchToHttp().getResponse();
    const jweToken = request.headers["x-encrypted-config"] as string;

    // Check for session token first (for subsequent requests)
    const sessionToken = request.headers["x-session-token"] as string;
    if (sessionToken) {
      const credentials = this.tokenExchangeService.getCredentials(
        sessionToken,
        request.user?.id,
      );
      if (credentials) {
        request.ephemeralCredentials = credentials;
        request.sessionToken = sessionToken;
        return next.handle();
      }

      // Session token expired or invalid.
      // If request does not include a fresh JWE envelope, fail closed so client can refresh credentials.
      if (!jweToken) {
        throw new UnauthorizedException(
          "Invalid or expired credential session",
        );
      }
    }

    // Check for JWE token (initial request or session renewal)
    if (jweToken) {
      try {
        const protectedHeader = decodeProtectedHeader(jweToken);
        const headerAlg = protectedHeader.alg;
        const algorithm = typeof headerAlg === "string" ? headerAlg : "";
        let payload: Awaited<ReturnType<typeof jwtDecrypt>>["payload"];

        if (algorithm === "dir") {
          const accessToken = this.getAccessToken(request);
          const sharedSecret = this.deriveSharedSecret(accessToken);
          ({ payload } = await jwtDecrypt(jweToken, sharedSecret, {
            keyManagementAlgorithms: ["dir"],
            contentEncryptionAlgorithms: ["A256GCM"],
          }));
        } else {
          const rsaAlgorithm =
            typeof headerAlg === "string" &&
            JWE_KEY_ALGORITHMS.includes(
              headerAlg as (typeof JWE_KEY_ALGORITHMS)[number],
            )
              ? (headerAlg as (typeof JWE_KEY_ALGORITHMS)[number])
              : JWE_KEY_ALGORITHM;

          const privateKey = await importPKCS8(
            SERVER_PRIVATE_KEY,
            rsaAlgorithm,
          );
          ({ payload } = await jwtDecrypt(jweToken, privateKey, {
            keyManagementAlgorithms: [...JWE_KEY_ALGORITHMS],
            contentEncryptionAlgorithms: ["A256GCM"],
          }));
        }

        // Extract credentials from payload
        const credentials: EphemeralCredentials = {
          llmKey: payload.llmKey as string | undefined,
          llmProvider: payload.llmProvider as string | undefined,
          llmBaseUrl: payload.llmBaseUrl as string | undefined,
          dbUrl: payload.dbUrl as string | undefined,
          dbKey: payload.dbKey as string | undefined,
          erpProvider: payload.erpProvider as string | undefined,
          erpBaseUrl: payload.erpBaseUrl as string | undefined,
          erpApiType: payload.erpApiType as string | undefined,
          erpDb: payload.erpDb as string | undefined,
          erpUsername: payload.erpUsername as string | undefined,
          erpPassword: payload.erpPassword as string | undefined,
          erpApiKey: payload.erpApiKey as string | undefined,
        };

        AppLogger.info("JweDecryptionInterceptor: Decrypted credentials", {
          erpProvider: credentials.erpProvider,
          hasSecrets: !!(credentials.erpPassword || credentials.erpApiKey),
        });

        // Validate required fields
        if (
          !credentials.llmKey &&
          !credentials.erpProvider &&
          !credentials.dbUrl
        ) {
          throw new UnauthorizedException(
            "Missing required credentials in JWE token",
          );
        }

        // Create session token for subsequent requests
        const newSessionToken =
          await this.tokenExchangeService.createSessionToken(credentials, {
            userId: request.user?.id,
          });

        request.ephemeralCredentials = credentials;
        request.sessionToken = newSessionToken;
        response.setHeader("x-session-token", newSessionToken);

        return next.handle();
      } catch (e) {
        AppLogger.error("JWE decryption failed", e);
        throw new UnauthorizedException("JWE decryption failed");
      }
    }

    return next.handle();
  }

  private getAccessToken(request: ExtendedRequest): string {
    const authHeaderRaw = request.headers.authorization;
    const authHeader = Array.isArray(authHeaderRaw)
      ? authHeaderRaw[0]
      : authHeaderRaw;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token for JWE decrypt");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing bearer token for JWE decrypt");
    }
    return token;
  }

  private deriveSharedSecret(accessToken: string): Uint8Array {
    return createHash("sha256").update(`axon-jwe:${accessToken}`).digest();
  }
}
