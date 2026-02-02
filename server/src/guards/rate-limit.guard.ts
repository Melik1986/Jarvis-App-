import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import Redis from "ioredis";
import { AppLogger } from "../utils/logger";

interface ExtendedRequest extends Request {
  user?: { id: string };
  ephemeralCredentials?: {
    llmKey?: string;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private redis: Redis | null = null;
  private readonly USE_REDIS = !!process.env.REDIS_URL;
  private readonly FALLBACK_MAP = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor() {
    if (this.USE_REDIS) {
      try {
        this.redis = new Redis(
          process.env.REDIS_URL || "redis://localhost:6379",
          {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
              if (times > 3) {
                AppLogger.warn(
                  "Redis connection failed, falling back to in-memory rate limiting",
                );
                this.redis = null;
                return null; // Stop retrying
              }
              return Math.min(times * 50, 2000);
            },
          },
        );

        this.redis.on("error", (error) => {
          AppLogger.warn("Redis error, falling back to in-memory:", error);
          this.redis = null;
        });

        AppLogger.info("Rate limiting using Redis");
      } catch (error) {
        AppLogger.warn(
          "Failed to connect to Redis, using in-memory fallback:",
          error,
        );
        this.redis = null;
      }
    } else {
      AppLogger.info("Rate limiting using in-memory (Redis not configured)");
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const userId = request.user?.id || "anonymous";

    // Two-level rate limiting: per-user and global
    const userKey = `rl:user:${userId}`;
    const globalKey = `rl:global`;

    if (this.redis) {
      // Use Redis for distributed rate limiting
      try {
        // Per-user limit: 100/min
        const userCount = await this.redis.incr(userKey);
        if (userCount === 1) {
          await this.redis.expire(userKey, 60);
        }
        if (userCount > 100) {
          throw new HttpException(
            "Rate limit exceeded (per user: 100/min)",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // Global limit: 1000/min (server protection)
        const globalCount = await this.redis.incr(globalKey);
        if (globalCount === 1) {
          await this.redis.expire(globalKey, 60);
        }
        if (globalCount > 1000) {
          throw new HttpException(
            "Rate limit exceeded (global: 1000/min)",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        return true;
      } catch (error) {
        if (
          error instanceof HttpException &&
          error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
        ) {
          throw error;
        }
        // Redis error, fallback to in-memory
        AppLogger.warn("Redis rate limit check failed, using fallback:", error);
        return this.checkInMemory(userKey, globalKey);
      }
    } else {
      // Fallback to in-memory rate limiting
      return this.checkInMemory(userKey, globalKey);
    }
  }

  private checkInMemory(userKey: string, globalKey: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute

    // Cleanup expired entries
    for (const [key, value] of this.FALLBACK_MAP.entries()) {
      if (value.resetAt < now) {
        this.FALLBACK_MAP.delete(key);
      }
    }

    // Per-user limit
    const userEntry = this.FALLBACK_MAP.get(userKey);
    if (userEntry && userEntry.resetAt > now) {
      if (userEntry.count >= 100) {
        throw new HttpException(
          "Rate limit exceeded (per user: 100/min)",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      userEntry.count++;
    } else {
      this.FALLBACK_MAP.set(userKey, { count: 1, resetAt: now + windowMs });
    }

    // Global limit
    const globalEntry = this.FALLBACK_MAP.get(globalKey);
    if (globalEntry && globalEntry.resetAt > now) {
      if (globalEntry.count >= 1000) {
        throw new HttpException(
          "Rate limit exceeded (global: 1000/min)",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      globalEntry.count++;
    } else {
      this.FALLBACK_MAP.set(globalKey, { count: 1, resetAt: now + windowMs });
    }

    return true;
  }
}
