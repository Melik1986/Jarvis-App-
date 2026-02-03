import { Injectable } from "@nestjs/common";
import { AppLogger } from "../utils/logger";

export interface ValidationResult {
  valid: boolean;
  message?: string;
  level: "error" | "warning";
}

@Injectable()
export class ValidationService {
  /**
   * Perform semantic validation of tool arguments.
   * This goes beyond basic schema validation.
   */
  async validate(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ValidationResult> {
    AppLogger.info(
      `Semantic validation for tool: ${toolName}`,
      undefined,
      "Validator",
    );

    if (toolName === "create_invoice") {
      return this.validateCreateInvoice(args);
    }

    if (toolName === "get_stock") {
      return this.validateGetStock(args);
    }

    return { valid: true, level: "warning" };
  }

  private validateCreateInvoice(
    args: Record<string, unknown>,
  ): ValidationResult {
    const items =
      (args.items as {
        product_name: string;
        quantity: number;
        price: number;
      }[]) || [];

    if (items.length === 0) {
      return {
        valid: false,
        message: "Документ не может быть пустым. Добавьте хотя бы один товар.",
        level: "error",
      };
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        return {
          valid: false,
          message: `Количество товара "${item.product_name}" должно быть больше нуля.`,
          level: "error",
        };
      }
      if (item.price < 0) {
        return {
          valid: false,
          message: `Цена товара "${item.product_name}" не может быть отрицательной.`,
          level: "error",
        };
      }
      // Semantic check: very high price warning
      if (item.price > 1000000) {
        return {
          valid: true,
          message: `Внимание: цена товара "${item.product_name}" превышает 1 000 000 ₽. Вы уверены?`,
          level: "warning",
        };
      }
    }

    return { valid: true, level: "warning" };
  }

  private validateGetStock(args: Record<string, unknown>): ValidationResult {
    const productName = args.product_name as string;
    if (!productName || productName.trim().length < 2) {
      return {
        valid: false,
        message: "Название товара слишком короткое для поиска.",
        level: "error",
      };
    }
    return { valid: true, level: "warning" };
  }
}
