import { validateReviewData } from "./reviewValidation";

describe("validateReviewData (Review & Confirm)", () => {
  it("returns valid when all items are correct", () => {
    const result = validateReviewData([
      { product_name: "Кола", quantity: 3, price: 50 },
      { product_name: "Пирожок", quantity: 1, price: 30 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid when quantity is negative", () => {
    const result = validateReviewData([
      { product_name: "Кола", quantity: -1, price: 50 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
  });

  it("returns invalid when quantity is zero", () => {
    const result = validateReviewData([
      { product_name: "Кола", quantity: 0, price: 50 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("greater than zero"))).toBe(
      true,
    );
  });

  it("returns invalid when product name is empty", () => {
    const result = validateReviewData([
      { product_name: "", quantity: 1, price: 50 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("product name"))).toBe(true);
  });

  it("returns invalid when price is negative", () => {
    const result = validateReviewData([
      { product_name: "Кола", quantity: 1, price: -10 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
  });

  it("returns invalid when items array is empty", () => {
    const result = validateReviewData([]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("At least one item"))).toBe(
      true,
    );
  });

  it("returns invalid when items is null/undefined (empty array handled)", () => {
    const result = validateReviewData([]);
    expect(result.valid).toBe(false);
  });
});
