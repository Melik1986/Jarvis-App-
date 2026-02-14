import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AppLogger } from "../utils/logger";
import { EphemeralCredentials } from "../modules/auth/auth.types";

interface SessionTokenEntry {
  credentials: EphemeralCredentials;
  userId?: string;
  issuedAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

interface SessionTokenOptions {
  userId?: string;
  ttlMs?: number;
}

@Injectable()
export class TokenExchangeService {
  private sessionTokens = new Map<string, SessionTokenEntry>();
  private readonly SESSION_TTL = 15 * 60 * 1000; // 15 minutes rolling TTL

  constructor() {
    // Cleanup expired tokens every minute
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60 * 1000);
  }

  async createSessionToken(
    credentials: EphemeralCredentials,
    options?: SessionTokenOptions,
  ): Promise<string> {
    const tokenId = randomUUID();
    const now = Date.now();
    const ttlMs = options?.ttlMs ?? this.SESSION_TTL;
    const expiresAt = now + ttlMs;

    this.sessionTokens.set(tokenId, {
      credentials,
      userId: options?.userId,
      issuedAt: now,
      lastSeenAt: now,
      expiresAt,
    });

    AppLogger.debug(`Created session token: ${tokenId.slice(0, 8)}...`);

    return tokenId;
  }

  getCredentials(
    sessionToken: string,
    expectedUserId?: string,
  ): EphemeralCredentials | null {
    const entry = this.sessionTokens.get(sessionToken);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.sessionTokens.delete(sessionToken);
      return null;
    }

    if (expectedUserId && entry.userId && entry.userId !== expectedUserId) {
      AppLogger.warn("Session token user mismatch", {
        tokenPrefix: sessionToken.slice(0, 8),
      });
      return null;
    }

    // Rolling TTL: keep active sessions alive while they are used.
    entry.lastSeenAt = Date.now();
    entry.expiresAt = entry.lastSeenAt + this.SESSION_TTL;

    return entry.credentials;
  }

  revokeSessionToken(sessionToken: string, expectedUserId?: string): boolean {
    const entry = this.sessionTokens.get(sessionToken);
    if (!entry) return false;

    if (expectedUserId && entry.userId && entry.userId !== expectedUserId) {
      return false;
    }

    this.sessionTokens.delete(sessionToken);
    return true;
  }

  revokeUserSessions(userId: string): number {
    let revoked = 0;
    for (const [tokenId, entry] of this.sessionTokens.entries()) {
      if (entry.userId === userId) {
        this.sessionTokens.delete(tokenId);
        revoked++;
      }
    }
    return revoked;
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [tokenId, entry] of this.sessionTokens.entries()) {
      if (entry.expiresAt < now) {
        this.sessionTokens.delete(tokenId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      AppLogger.debug(`Cleaned up ${cleaned} expired session tokens`);
    }
  }

  getActiveSessionsCount(): number {
    return this.sessionTokens.size;
  }
}
