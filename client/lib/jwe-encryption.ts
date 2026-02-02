import { importSPKI, EncryptJWT } from "jose";

export interface EphemeralCredentials {
  llmKey: string;
  llmProvider: string;
  llmBaseUrl?: string;
  dbUrl?: string;
  dbKey?: string;
  erpUrl?: string;
  erpType?: string;
}

/**
 * Encrypts credentials to JWE token using server's public key.
 * Client should fetch public key from /api/auth/public-key first.
 */
export async function encryptCredentialsToJWE(
  credentials: EphemeralCredentials,
  publicKeyPem: string,
): Promise<string> {
  try {
    const publicKey = await importSPKI(publicKeyPem, "ECDH-ES+HKDF-256");

    const encrypted = await new EncryptJWT({
      llmKey: credentials.llmKey,
      llmProvider: credentials.llmProvider,
      ...(credentials.llmBaseUrl && { llmBaseUrl: credentials.llmBaseUrl }),
      ...(credentials.dbUrl && { dbUrl: credentials.dbUrl }),
      ...(credentials.dbKey && { dbKey: credentials.dbKey }),
      ...(credentials.erpUrl && { erpUrl: credentials.erpUrl }),
      ...(credentials.erpType && { erpType: credentials.erpType }),
    })
      .setProtectedHeader({ alg: "ECDH-ES+HKDF-256", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer("axon-client")
      .encrypt(publicKey);

    return encrypted;
  } catch (error) {
    throw new Error(`Failed to encrypt credentials: ${error}`);
  }
}
