import { parseToolArgs } from "./tool-args";

describe("parseToolArgs (Data Mapper)", () => {
  describe("get_stock", () => {
    it("parses valid JSON", () => {
      const result = parseToolArgs("get_stock", { product_name: "кофе" });
      expect(result).toEqual({ product_name: "кофе" });
    });

    it("throws on missing required field", () => {
      expect(() => parseToolArgs("get_stock", {})).toThrow();
    });

    it("throws on wrong type (number instead of string)", () => {
      expect(() => parseToolArgs("get_stock", { product_name: 123 })).toThrow();
    });

    it("strips extra fields (Zod default)", () => {
      const result = parseToolArgs("get_stock", {
        product_name: "молоко",
        extra: "ignored",
      });
      expect(result).toEqual({ product_name: "молоко" });
    });
  });

  describe("get_products", () => {
    it("parses valid JSON with optional filter", () => {
      const result = parseToolArgs("get_products", { filter: "сахар" });
      expect(result).toEqual({ filter: "сахар" });
    });

    it("parses valid JSON without filter", () => {
      const result = parseToolArgs("get_products", {});
      expect(result).toEqual({});
    });
  });

  describe("create_invoice", () => {
    it("parses valid JSON", () => {
      const raw = {
        customer_name: "ООО Рога",
        items: [
          { product_name: "Кола", quantity: 3, price: 50 },
          { product_name: "Пирожок", quantity: 1, price: 30 },
        ],
        comment: "срочно",
      };
      const result = parseToolArgs("create_invoice", raw);
      expect(result).toEqual(raw);
    });

    it("parses negative quantity (Zod allows; business validation elsewhere)", () => {
      const raw = {
        items: [{ product_name: "Кола", quantity: -1, price: 50 }],
      };
      const result = parseToolArgs("create_invoice", raw) as {
        items: { quantity: number }[];
      };
      expect(result.items[0].quantity).toBe(-1);
    });

    it("throws on malformed JSON (string instead of number for quantity)", () => {
      const raw = {
        items: [{ product_name: "Кола", quantity: "three", price: 50 }],
      };
      expect(() => parseToolArgs("create_invoice", raw)).toThrow();
    });

    it("parses empty items array", () => {
      const raw = { items: [] };
      const result = parseToolArgs("create_invoice", raw) as {
        items: unknown[];
      };
      expect(result.items).toEqual([]);
    });

    it("throws on missing required items", () => {
      expect(() => parseToolArgs("create_invoice", {})).toThrow();
    });

    it("throws on unknown tool", () => {
      expect(() => parseToolArgs("unknown_tool", {})).toThrow("Unknown tool");
    });
  });
});
