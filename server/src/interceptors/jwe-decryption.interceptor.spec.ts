import { createHash, webcrypto } from "crypto";
import {
  CallHandler,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { Request, Response } from "express";
import {
  encryptCredentialsToJWE,
  EphemeralCredentials,
} from "@/lib/jwe-encryption";
import { JweDecryptionInterceptor } from "./jwe-decryption.interceptor";
import { TokenExchangeService } from "../services/token-exchange.service";

jest.mock("@/polyfills/webcrypto", () => ({
  ensureWebCryptoReady: jest.fn().mockResolvedValue(undefined),
}));

interface RequestWithAuth extends Request {
  user?: { id?: string };
  ephemeralCredentials?: EphemeralCredentials;
  sessionToken?: string;
}

interface ResponseWithSetHeader extends Response {
  setHeader: (name: string, value: string) => ResponseWithSetHeader;
}

function deriveSharedSecret(accessToken: string): Uint8Array {
  return createHash("sha256").update(`axon-jwe:${accessToken}`).digest();
}

function createExecutionContext(
  req: RequestWithAuth,
  res: ResponseWithSetHeader,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe("JweDecryptionInterceptor", () => {
  const globalWithCrypto = globalThis as typeof globalThis & {
    crypto?: Crypto;
  };
  const originalCrypto = globalWithCrypto.crypto;

  beforeAll(() => {
    globalWithCrypto.crypto = webcrypto as unknown as Crypto;
  });

  afterAll(() => {
    globalWithCrypto.crypto = originalCrypto;
  });

  it("decrypts client JWE (alg=dir) and issues x-session-token", async () => {
    const accessToken = "access-token-for-jwe";
    const credentials: EphemeralCredentials = {
      llmKey: "llm-secret",
      llmProvider: "openai",
      llmBaseUrl: "https://api.openai.com/v1",
      erpProvider: "odoo",
      erpBaseUrl: "https://example.odoo.com",
      erpUsername: "user@example.com",
      erpApiKey: "erp-secret",
    };

    const jweToken = await encryptCredentialsToJWE(
      credentials,
      { sharedSecretKey: deriveSharedSecret(accessToken) },
      { preferredAlgorithm: "dir", supportedAlgorithms: ["dir"] },
    );

    const request = {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-encrypted-config": jweToken,
      },
      user: { id: "user-1" },
    } as unknown as RequestWithAuth;

    const setHeader = jest.fn();
    const response = {
      setHeader,
    } as unknown as ResponseWithSetHeader;

    const tokenExchangeMock: Pick<
      TokenExchangeService,
      "getCredentials" | "createSessionToken"
    > = {
      getCredentials: jest.fn().mockReturnValue(null),
      createSessionToken: jest.fn().mockResolvedValue("session-token-1"),
    };

    const interceptor = new JweDecryptionInterceptor(
      tokenExchangeMock as TokenExchangeService,
    );

    const next: CallHandler = {
      handle: jest.fn(() => of({ ok: true })),
    };

    const context = createExecutionContext(request, response);
    const stream$ = await interceptor.intercept(context, next);
    const result = await firstValueFrom(stream$);

    expect(result).toEqual({ ok: true });
    expect(request.ephemeralCredentials).toMatchObject({
      llmKey: "llm-secret",
      erpApiKey: "erp-secret",
      erpProvider: "odoo",
    });
    expect(tokenExchangeMock.createSessionToken).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith(
      "x-session-token",
      "session-token-1",
    );
  });

  it("rejects invalid session token when no encrypted envelope is provided", async () => {
    const request = {
      headers: {
        authorization: "Bearer access-token",
        "x-session-token": "expired-token",
      },
      user: { id: "user-1" },
    } as unknown as RequestWithAuth;

    const response = {
      setHeader: jest.fn(),
    } as unknown as ResponseWithSetHeader;

    const tokenExchangeMock: Pick<
      TokenExchangeService,
      "getCredentials" | "createSessionToken"
    > = {
      getCredentials: jest.fn().mockReturnValue(null),
      createSessionToken: jest.fn().mockResolvedValue("unused-token"),
    };

    const interceptor = new JweDecryptionInterceptor(
      tokenExchangeMock as TokenExchangeService,
    );
    const next: CallHandler = {
      handle: jest.fn(() => of({ ok: true })),
    };

    const context = createExecutionContext(request, response);
    await expect(interceptor.intercept(context, next)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
