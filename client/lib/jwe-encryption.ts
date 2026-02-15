import { importJWK, importSPKI, EncryptJWT } from "jose";
import type { JWK } from "jose";
import { ensureWebCryptoReady } from "@/polyfills/webcrypto";

export const JWE_KEY_ALGORITHMS = ["dir", "RSA-OAEP-256", "RSA-OAEP"] as const;
export type JweKeyAlgorithm = (typeof JWE_KEY_ALGORITHMS)[number];

export interface JwePublicJwk {
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
  kid?: string;
  use?: string;
  ext?: boolean;
  key_ops?: string[];
}

export interface EphemeralCredentials {
  llmKey?: string;
  llmProvider?: string;
  llmBaseUrl?: string;
  dbUrl?: string;
  dbKey?: string;
  erpProvider?: string;
  erpBaseUrl?: string;
  erpApiType?: string;
  erpDb?: string;
  erpUsername?: string;
  erpPassword?: string;
  erpApiKey?: string;
}

interface JweKeyMaterial {
  sharedSecretKey?: Uint8Array;
  publicKeyPem?: string;
  publicJwk?: JwePublicJwk;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type JoseEncryptionKey = Parameters<EncryptJWT["encrypt"]>[0];

function isKeyLikeRecord(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRsaOaepPublicKeyForJose(key: unknown): void {
  if (!isKeyLikeRecord(key)) return;
  if (key[Symbol.toStringTag] !== "CryptoKey") {
    try {
      Object.defineProperty(key, Symbol.toStringTag, {
        value: "CryptoKey",
        configurable: true,
      });
    } catch {
      try {
        key[Symbol.toStringTag] = "CryptoKey";
      } catch {
        // Best-effort compatibility for polyfilled CryptoKey objects.
      }
    }
  }

  if (key.type !== "public") return;

  const usageSet = new Set<string>();
  if (Array.isArray(key.usages)) {
    for (const usage of key.usages) {
      if (typeof usage === "string") {
        usageSet.add(usage);
      }
    }
  }
  usageSet.add("encrypt");
  usageSet.add("wrapKey");

  const normalizedUsages = Array.from(usageSet);
  try {
    Object.defineProperty(key, "usages", {
      value: normalizedUsages,
      configurable: true,
    });
  } catch {
    try {
      key.usages = normalizedUsages;
    } catch {
      // Some polyfills expose read-only usages; keep original if immutable.
    }
  }
}

async function resolveEncryptionKeys(
  keyMaterial: JweKeyMaterial,
  algorithm: JweKeyAlgorithm,
): Promise<JoseEncryptionKey[]> {
  const keys: JoseEncryptionKey[] = [];

  if (algorithm === "dir") {
    if (keyMaterial.sharedSecretKey && keyMaterial.sharedSecretKey.length > 0) {
      if (keyMaterial.sharedSecretKey.length !== 32) {
        throw new Error(
          `Invalid dir shared key length: expected 32 bytes, got ${keyMaterial.sharedSecretKey.length}`,
        );
      }
      keys.push(keyMaterial.sharedSecretKey);
    }
    return keys;
  }

  if (keyMaterial.publicKeyPem) {
    const importedFromPem = await importSPKI(
      keyMaterial.publicKeyPem,
      algorithm,
    );
    normalizeRsaOaepPublicKeyForJose(importedFromPem);
    keys.push(importedFromPem);
  }

  if (keys.length > 0) {
    return keys;
  }

  if (!keyMaterial.publicJwk) {
    return keys;
  }

  const rsaPublicJwk = toRsaPublicJwk(keyMaterial.publicJwk);
  if (!rsaPublicJwk) {
    throw new Error("Invalid server public JWK");
  }

  const importedFromJwk = await importJWK(
    {
      ...rsaPublicJwk,
      alg: algorithm,
      use: "enc",
    },
    algorithm,
  );
  normalizeRsaOaepPublicKeyForJose(importedFromJwk);
  keys.push(importedFromJwk);

  return keys;
}

function toRsaPublicJwk(value: unknown): JWK | null {
  if (!isRecord(value)) return null;
  if (value.kty !== "RSA") return null;
  if (typeof value.n !== "string" || !value.n) return null;
  if (typeof value.e !== "string" || !value.e) return null;

  const jwk: JWK = {
    kty: "RSA",
    n: value.n,
    e: value.e,
  };

  if (typeof value.kid === "string") jwk.kid = value.kid;
  if (typeof value.use === "string") jwk.use = value.use;
  if (typeof value.alg === "string") jwk.alg = value.alg;
  if (typeof value.ext === "boolean") jwk.ext = value.ext;
  if (Array.isArray(value.key_ops)) {
    jwk.key_ops = value.key_ops.filter(
      (op): op is string => typeof op === "string",
    );
  }

  return jwk;
}

function isJweKeyAlgorithm(value: unknown): value is JweKeyAlgorithm {
  return (
    typeof value === "string" &&
    JWE_KEY_ALGORITHMS.includes(value as JweKeyAlgorithm)
  );
}

function getEncryptionAlgorithmCandidates(
  preferredAlgorithm?: string,
  supportedAlgorithms?: string[],
): JweKeyAlgorithm[] {
  const prioritized: JweKeyAlgorithm[] = [];
  const explicitSupported = (supportedAlgorithms || []).filter((algorithm) =>
    isJweKeyAlgorithm(algorithm),
  );

  if (isJweKeyAlgorithm(preferredAlgorithm)) {
    prioritized.push(preferredAlgorithm);
  }

  for (const algorithm of explicitSupported) {
    if (!prioritized.includes(algorithm)) {
      prioritized.push(algorithm);
    }
  }

  if (explicitSupported.length > 0) {
    return prioritized;
  }

  for (const algorithm of JWE_KEY_ALGORITHMS) {
    if (!prioritized.includes(algorithm)) {
      prioritized.push(algorithm);
    }
  }

  return prioritized;
}

function assertWebCryptoAvailable(): void {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (!cryptoApi || !cryptoApi.subtle) {
    throw new Error(
      "WebCrypto API is unavailable. Ensure isomorphic-webcrypto is imported before app initialization.",
    );
  }
}

/**
 * Encrypts credentials to JWE token using server's public key.
 * Client should fetch public key from /api/auth/public-key first.
 */
export async function encryptCredentialsToJWE(
  credentials: EphemeralCredentials,
  keyMaterial: JweKeyMaterial,
  options?: {
    preferredAlgorithm?: string;
    supportedAlgorithms?: string[];
  },
): Promise<string> {
  const candidateAlgorithms = getEncryptionAlgorithmCandidates(
    options?.preferredAlgorithm,
    options?.supportedAlgorithms,
  );

  try {
    await ensureWebCryptoReady();
    assertWebCryptoAvailable();

    if (
      !keyMaterial.sharedSecretKey &&
      !keyMaterial.publicJwk &&
      !keyMaterial.publicKeyPem
    ) {
      throw new Error("Missing server public key material");
    }

    let lastError: unknown = null;
    for (const algorithm of candidateAlgorithms) {
      try {
        const encryptionKeys = await resolveEncryptionKeys(
          keyMaterial,
          algorithm,
        );
        if (encryptionKeys.length === 0) {
          throw new Error("Missing server public key material");
        }

        let encryptionError: unknown = null;
        for (const encryptionKey of encryptionKeys) {
          try {
            return await new EncryptJWT({
              ...(credentials.llmKey && { llmKey: credentials.llmKey }),
              ...(credentials.llmProvider && {
                llmProvider: credentials.llmProvider,
              }),
              ...(credentials.llmBaseUrl && {
                llmBaseUrl: credentials.llmBaseUrl,
              }),
              ...(credentials.dbUrl && { dbUrl: credentials.dbUrl }),
              ...(credentials.dbKey && { dbKey: credentials.dbKey }),
              ...(credentials.erpProvider && {
                erpProvider: credentials.erpProvider,
              }),
              ...(credentials.erpBaseUrl && {
                erpBaseUrl: credentials.erpBaseUrl,
              }),
              ...(credentials.erpApiType && {
                erpApiType: credentials.erpApiType,
              }),
              ...(credentials.erpDb && { erpDb: credentials.erpDb }),
              ...(credentials.erpUsername && {
                erpUsername: credentials.erpUsername,
              }),
              ...(credentials.erpPassword && {
                erpPassword: credentials.erpPassword,
              }),
              ...(credentials.erpApiKey && {
                erpApiKey: credentials.erpApiKey,
              }),
            })
              .setProtectedHeader({ alg: algorithm, enc: "A256GCM" })
              .setIssuedAt()
              .setExpirationTime("5m")
              .setIssuer("axon-client")
              .encrypt(encryptionKey);
          } catch (keyError) {
            encryptionError = keyError;
          }
        }

        throw (
          encryptionError ?? new Error("No encryption key variant succeeded")
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `No compatible JWE key algorithm found (${candidateAlgorithms.join(", ")})${lastError ? `: ${String(lastError)}` : ""}`,
    );
  } catch (error) {
    throw new Error(`Failed to encrypt credentials: ${error}`);
  }
}
