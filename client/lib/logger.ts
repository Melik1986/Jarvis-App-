/**
 * Structured error details for rich error logging
 */
interface StructuredError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

/**
 * Logging levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Logging options
 */
interface LogOptions {
  timestamp?: boolean;
  prefix?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Universal utility for application logging (Client)
 * Extended version with logging levels and timestamps
 */
export class AppLogger {
  // In React Native use global variable __DEV__
  private static isDevelopment = __DEV__;
  private static currentLevel: LogLevel = __DEV__
    ? LogLevel.DEBUG
    : LogLevel.WARN;

  /**
   * Set logging level
   */
  static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get current logging level
   */
  static getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Message formatting with timestamp
   */
  private static formatMessage(
    level: string,
    message: string,
    options?: LogOptions,
  ): string {
    const timestamp =
      options?.timestamp !== false ? new Date().toISOString() : "";
    const prefix = options?.prefix ? `[${options.prefix}]` : "[App]";

    return timestamp
      ? `${timestamp} ${prefix} [${level}] ${message}`
      : `${prefix} [${level}] ${message}`;
  }

  /**
   * Check if logging is needed for current level
   */
  private static shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  static log(message: string, data?: unknown, prefix?: string): void {
    if (this.isDevelopment && this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage("INFO", message, {
        prefix,
        timestamp: true,
      });
      // eslint-disable-next-line no-console
      console.log(formatted, data || "");
    }
  }

  static error(message: string, error?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formatted = this.formatMessage("ERROR", message, {
      prefix,
      timestamp: true,
    });

    if (error) {
      if (typeof error === "object" && error !== null) {
        const structured = error as StructuredError;
        if (structured.message || structured.details || structured.hint) {
          // eslint-disable-next-line no-console
          console.error(formatted, {
            message: structured.message,
            details: structured.details,
            hint: structured.hint,
            code: structured.code,
          });
        } else if (Object.keys(error).length > 0) {
          // eslint-disable-next-line no-console
          console.error(formatted, error);
        } else {
          // eslint-disable-next-line no-console
          console.error(formatted);
        }
      } else {
        // eslint-disable-next-line no-console
        console.error(formatted, error);
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(formatted);
    }
  }

  static warn(message: string, data?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formatted = this.formatMessage("WARN", message, {
      prefix,
      timestamp: true,
    });
    // eslint-disable-next-line no-console
    console.warn(formatted, data || "");
  }

  static info(message: string, data?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formatted = this.formatMessage("INFO", message, {
      prefix,
      timestamp: true,
    });
    // eslint-disable-next-line no-console
    console.info(formatted, data || "");
  }

  static debug(message: string, data?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formatted = this.formatMessage("DEBUG", message, {
      prefix,
      timestamp: true,
    });
    // eslint-disable-next-line no-console
    console.debug(formatted, data || "");
  }

  /**
   * Group logs (for debugging)
   */
  static group(label: string): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.group(label);
    }
  }

  static groupEnd(): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  }

  /**
   * Timer for performance measurement
   */
  static time(label: string): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.time(label);
    }
  }

  static timeEnd(label: string): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.timeEnd(label);
    }
  }

  /**
   * Table output (for debugging)
   */
  static table(data: unknown): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.table(data);
    }
  }
}
