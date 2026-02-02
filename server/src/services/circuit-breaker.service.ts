import { Injectable } from "@nestjs/common";
import CircuitBreaker from "opossum";
import { AppLogger } from "../utils/logger";

interface BreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
}

@Injectable()
export class CircuitBreakerService {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a given key.
   */
  getBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
    key: string,
    fn: T,
    options?: BreakerOptions,
  ): CircuitBreaker {
    if (!this.breakers.has(key)) {
      const breaker = new CircuitBreaker(fn, {
        timeout: options?.timeout || 5000,
        errorThresholdPercentage: options?.errorThresholdPercentage || 50,
        resetTimeout: options?.resetTimeout || 30000,
        rollingCountTimeout: options?.rollingCountTimeout || 60000,
        rollingCountBuckets: options?.rollingCountBuckets || 10,
      });

      breaker.on("open", () => {
        AppLogger.warn(`Circuit breaker OPEN for ${key}`);
      });

      breaker.on("halfOpen", () => {
        AppLogger.info(`Circuit breaker HALF-OPEN for ${key}`);
      });

      breaker.on("close", () => {
        AppLogger.info(`Circuit breaker CLOSED for ${key}`);
      });

      breaker.on("failure", (error: Error) => {
        AppLogger.warn(`Circuit breaker failure for ${key}:`, error);
      });

      this.breakers.set(key, breaker);
    }

    return this.breakers.get(key)!;
  }

  /**
   * Check if circuit breaker is open for a given key.
   */
  isOpen(key: string): boolean {
    const breaker = this.breakers.get(key);
    return breaker ? breaker.opened : false;
  }
}
