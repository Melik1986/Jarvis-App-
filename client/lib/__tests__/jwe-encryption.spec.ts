import { createHash, webcrypto } from "crypto";
import { jwtDecrypt } from "jose";
import {
  encryptCredentialsToJWE,
  EphemeralCredentials,
} from "@/lib/jwe-encryption";

jest.mock("@/polyfills/webcrypto", () => ({
  ensureWebCryptoReady: jest.fn().mockResolvedValue(undefined),
}));

function deriveSharedSecret(accessToken: string): Uint8Array {
  return createHash("sha256").update(`axon-jwe:${accessToken}`).digest();
}

describe("encryptCredentialsToJWE", () => {
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

  it("encrypts credentials with alg=dir and can be decrypted with the same shared secret", async () => {
    const accessToken = "test-access-token";
    const sharedSecretKey = deriveSharedSecret(accessToken);
    const credentials: EphemeralCredentials = {
      llmKey: "llm-key",
      llmProvider: "openai",
      llmBaseUrl: "https://api.openai.com/v1",
      erpProvider: "odoo",
      erpBaseUrl: "https://example.odoo.com",
      erpUsername: "user@example.com",
      erpApiKey: "erp-api-key",
    };

    const jwe = await encryptCredentialsToJWE(
      credentials,
      { sharedSecretKey },
      { preferredAlgorithm: "dir", supportedAlgorithms: ["dir"] },
    );

    const { payload, protectedHeader } = await jwtDecrypt(
      jwe,
      sharedSecretKey,
      {
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      },
    );

    expect(protectedHeader.alg).toBe("dir");
    expect(protectedHeader.enc).toBe("A256GCM");
    expect(payload.llmKey).toBe("llm-key");
    expect(payload.erpApiKey).toBe("erp-api-key");
    expect(payload.erpProvider).toBe("odoo");
  });

  it("fails when key material is missing", async () => {
    const credentials: EphemeralCredentials = {
      llmKey: "llm-key",
    };

    await expect(
      encryptCredentialsToJWE(credentials, {}, { preferredAlgorithm: "dir" }),
    ).rejects.toThrow("Missing server public key material");
  });
});
