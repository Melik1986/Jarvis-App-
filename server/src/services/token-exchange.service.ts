import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AppLogger } from "../utils/logger";

interface SessionTokenEntry {
  credentials: {
    llmKey: string;
    llmProvider: string;
    llmBaseUrl?: string;
    dbUrl?: string;
    dbKey?: string;
    erpUrl?: string;
    erpType?: string;
  };
  expiresAt: number;
}

@Injectable()
export class TokenExchangeService {
  private sessionTokens = new Map<string, SessionTokenEntry>();
  private readonly SESSION_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Cleanup expired tokens every minute
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60 * 1000);
  }

  async createSessionToken(
    credentials: SessionTokenEntry["credentials"],
  ): Promise<string> {
    const tokenId = randomUUID();
    const expiresAt = Date.now() + this.SESSION_TTL;

    this.sessionTokens.set(tokenId, {
      credentials,
      expiresAt,
    });

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.sessionTokens.delete(tokenId);
    }, this.SESSION_TTL);

    AppLogger.debug(`Created session token: ${tokenId.slice(0, 8)}...`);

    return tokenId;
  }

  getCredentials(
    sessionToken: string,
  ): SessionTokenEntry["credentials"] | null {
    const entry = this.sessionTokens.get(sessionToken);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.sessionTokens.delete(sessionToken);
      return null;
    }

    return entry.credentials;
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
