import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import OpenAI from "openai";
import { AppLogger } from "../utils/logger";

interface ClientEntry {
  client: OpenAI;
  refCount: number;
  createdAt: number;
  lastUsed: number;
}

interface EphemeralCredentials {
  llmKey: string;
  llmProvider: string;
  llmBaseUrl?: string;
}

@Injectable()
export class EphemeralClientPoolService {
  private clients = new Map<string, ClientEntry>();
  private readonly STREAMING_TTL = 5 * 60 * 1000; // 5 minutes for streaming
  private readonly REGULAR_TTL = 60 * 1000; // 1 minute for regular requests
  private readonly MAX_CACHE_SIZE = 1000; // LRU eviction limit

  constructor() {
    // Cleanup expired clients every minute
    setInterval(() => {
      this.cleanupExpiredClients();
    }, 60 * 1000);
  }

  private hashCredentials(credentials: EphemeralCredentials): string {
    return createHash("sha256")
      .update(JSON.stringify(credentials))
      .digest("hex");
  }

  async useClient<T>(
    credentials: EphemeralCredentials,
    fn: (client: OpenAI) => Promise<T>,
    isStreaming = false,
  ): Promise<T> {
    const key = this.hashCredentials(credentials);

    // LRU eviction if cache is full
    if (this.clients.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    // Get or create client
    if (!this.clients.has(key)) {
      const client = this.createClient(credentials);
      this.clients.set(key, {
        client,
        refCount: 0,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      });
      AppLogger.debug(
        `Created new ephemeral client for provider: ${credentials.llmProvider}`,
      );
    }

    const entry = this.clients.get(key)!;
    entry.refCount++;
    entry.lastUsed = Date.now();

    const ttl = isStreaming ? this.STREAMING_TTL : this.REGULAR_TTL;

    try {
      return await fn(entry.client);
    } finally {
      entry.refCount--;

      // Cleanup only if refCount = 0 and TTL has passed
      if (entry.refCount === 0) {
        setTimeout(() => {
          const currentEntry = this.clients.get(key);
          if (currentEntry && currentEntry.refCount === 0) {
            this.clients.delete(key);
            AppLogger.debug(
              `Cleaned up ephemeral client: ${key.slice(0, 8)}...`,
            );
          }
        }, ttl);
      }
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.clients.entries()) {
      if (entry.refCount === 0 && entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.clients.delete(oldestKey);
      AppLogger.debug(`LRU evicted client: ${oldestKey.slice(0, 8)}...`);
    }
  }

  private createClient(credentials: EphemeralCredentials): OpenAI {
    const baseURL =
      credentials.llmBaseUrl ||
      (credentials.llmProvider === "openai"
        ? "https://api.openai.com/v1"
        : credentials.llmProvider === "groq"
          ? "https://api.groq.com/openai/v1"
          : undefined);

    return new OpenAI({
      apiKey: credentials.llmKey,
      baseURL,
    });
  }

  private cleanupExpiredClients(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.clients.entries()) {
      // Only cleanup if refCount is 0 and client is old enough
      if (
        entry.refCount === 0 &&
        now - entry.lastUsed > this.REGULAR_TTL &&
        now - entry.createdAt > this.STREAMING_TTL
      ) {
        this.clients.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      AppLogger.debug(`Cleaned up ${cleaned} expired ephemeral clients`);
    }
  }

  getActiveClientsCount(): number {
    return this.clients.size;
  }

  getActiveReferencesCount(): number {
    let total = 0;
    for (const entry of this.clients.values()) {
      total += entry.refCount;
    }
    return total;
  }
}
