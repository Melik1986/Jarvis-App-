/**
 * Интерфейс для ошибок Supabase
 */
import { sanitizeForLogging } from "./logger-sanitizer";

interface SupabaseError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

/**
 * Уровни логирования
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Опции логирования
 */
interface LogOptions {
  timestamp?: boolean;
  prefix?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Универсальная утилита для логирования в приложении (Server)
 * Расширенная версия с уровнями логирования и timestamps
 */
export class AppLogger {
  // В Node.js используем process.env.NODE_ENV
  private static isDevelopment = process.env.NODE_ENV !== "production";
  private static currentLevel: LogLevel =
    process.env.NODE_ENV !== "production" ? LogLevel.DEBUG : LogLevel.WARN;

  /**
   * Установить уровень логирования
   */
  static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Получить текущий уровень логирования
   */
  static getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Форматирование сообщения с timestamp
   */
  private static formatMessage(
    level: string,
    message: string,
    options?: LogOptions,
  ): string {
    const timestamp =
      options?.timestamp !== false ? new Date().toISOString() : "";
    const prefix = options?.prefix ? `[${options.prefix}]` : "[Server]";

    return timestamp
      ? `${timestamp} ${prefix} [${level}] ${message}`
      : `${prefix} [${level}] ${message}`;
  }

  /**
   * Проверка, нужно ли логировать для текущего уровня
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
      const sanitized = data ? sanitizeForLogging(data) : "";
      // eslint-disable-next-line no-console
      console.log(formatted, sanitized);
    }
  }

  static error(message: string, error?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formatted = this.formatMessage("ERROR", message, {
      prefix,
      timestamp: true,
    });

    if (error) {
      // Специальная обработка для ошибок Supabase
      if (typeof error === "object" && error !== null) {
        const supabaseError = error as SupabaseError;
        if (
          supabaseError.message ||
          supabaseError.details ||
          supabaseError.hint
        ) {
          const sanitized = sanitizeForLogging({
            message: supabaseError.message,
            details: supabaseError.details,
            hint: supabaseError.hint,
            code: supabaseError.code,
          });
          // eslint-disable-next-line no-console
          console.error(formatted, sanitized);
        } else if (Object.keys(error).length > 0) {
          const sanitized = sanitizeForLogging(error);
          // eslint-disable-next-line no-console
          console.error(formatted, sanitized);
        } else {
          // eslint-disable-next-line no-console
          console.error(formatted, "Empty error object");
        }
      } else {
        const sanitized = sanitizeForLogging(error);
        // eslint-disable-next-line no-console
        console.error(formatted, sanitized);
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
    const sanitized = data ? sanitizeForLogging(data) : "";
    // eslint-disable-next-line no-console
    console.warn(formatted, sanitized);
  }

  static info(message: string, data?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formatted = this.formatMessage("INFO", message, {
      prefix,
      timestamp: true,
    });
    const sanitized = data ? sanitizeForLogging(data) : "";
    // eslint-disable-next-line no-console
    console.info(formatted, sanitized);
  }

  static debug(message: string, data?: unknown, prefix?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formatted = this.formatMessage("DEBUG", message, {
      prefix,
      timestamp: true,
    });
    const sanitized = data ? sanitizeForLogging(data) : "";
    // eslint-disable-next-line no-console
    console.debug(formatted, sanitized);
  }

  /**
   * Группирование логов (для debugging)
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
   * Таймер для замера производительности
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
   * Вывод таблицы (для debugging)
   */
  static table(data: unknown): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.table(data);
    }
  }
}
