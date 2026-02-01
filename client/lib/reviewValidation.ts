/**
 * Item shape used for "Review & Confirm" before sending to 1C.
 */
export interface ReviewItem {
  product_name: string;
  quantity: number;
  price: number;
}

export interface ReviewValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates data before "Submit to 1C" (Review & Confirm).
 * Returns valid: false when e.g. negative quantity or empty required fields,
 * so the submit button can be disabled.
 */
export function validateReviewData(
  items: ReviewItem[],
): ReviewValidationResult {
  const errors: string[] = [];

  if (!items || items.length === 0) {
    errors.push("At least one item is required");
    return { valid: false, errors };
  }

  items.forEach((item, index) => {
    const prefix = `Item ${index + 1}`;
    if (!item.product_name?.trim()) {
      errors.push(`${prefix}: product name is required`);
    }
    if (typeof item.quantity !== "number" || Number.isNaN(item.quantity)) {
      errors.push(`${prefix}: quantity must be a number`);
    } else if (item.quantity < 0) {
      errors.push(`${prefix}: quantity cannot be negative`);
    } else if (item.quantity === 0) {
      errors.push(`${prefix}: quantity must be greater than zero`);
    }
    if (typeof item.price !== "number" || Number.isNaN(item.price)) {
      errors.push(`${prefix}: price must be a number`);
    } else if (item.price < 0) {
      errors.push(`${prefix}: price cannot be negative`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
