import { importSPKI, EncryptJWT } from "jose";

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

/**
 * Encrypts credentials to JWE token using server's public key.
 * Client should fetch public key from /api/auth/public-key first.
 */
export async function encryptCredentialsToJWE(
  credentials: EphemeralCredentials,
  publicKeyPem: string,
): Promise<string> {
  try {
    const publicKey = await importSPKI(publicKeyPem, "ECDH-ES");

    const encrypted = await new EncryptJWT({
      ...(credentials.llmKey && { llmKey: credentials.llmKey }),
      ...(credentials.llmProvider && { llmProvider: credentials.llmProvider }),
      ...(credentials.llmBaseUrl && { llmBaseUrl: credentials.llmBaseUrl }),
      ...(credentials.dbUrl && { dbUrl: credentials.dbUrl }),
      ...(credentials.dbKey && { dbKey: credentials.dbKey }),
      ...(credentials.erpProvider && { erpProvider: credentials.erpProvider }),
      ...(credentials.erpBaseUrl && { erpBaseUrl: credentials.erpBaseUrl }),
      ...(credentials.erpApiType && { erpApiType: credentials.erpApiType }),
      ...(credentials.erpDb && { erpDb: credentials.erpDb }),
      ...(credentials.erpUsername && { erpUsername: credentials.erpUsername }),
      ...(credentials.erpPassword && { erpPassword: credentials.erpPassword }),
      ...(credentials.erpApiKey && { erpApiKey: credentials.erpApiKey }),
    })
      .setProtectedHeader({ alg: "ECDH-ES", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer("axon-client")
      .encrypt(publicKey);

    return encrypted;
  } catch (error) {
    throw new Error(`Failed to encrypt credentials: ${error}`);
  }
}
