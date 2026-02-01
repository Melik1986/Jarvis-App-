import { z } from "zod";

const getStockSchema = z.object({
  product_name: z.string(),
});

const getProductsSchema = z.object({
  filter: z.string().optional(),
});

const createInvoiceItemSchema = z.object({
  product_name: z.string(),
  quantity: z.number(),
  price: z.number(),
});

const createInvoiceSchema = z.object({
  customer_name: z.string().optional(),
  items: z.array(createInvoiceItemSchema),
  comment: z.string().optional(),
});

const schemas: Record<string, z.ZodType> = {
  get_stock: getStockSchema,
  get_products: getProductsSchema,
  create_invoice: createInvoiceSchema,
};

/**
 * Parses raw JSON (e.g. from LLM tool call) into validated tool args.
 * Throws ZodError with clear message on invalid input.
 */
export function parseToolArgs(
  toolName: string,
  rawJson: unknown,
): Record<string, unknown> {
  const schema = schemas[toolName];
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return schema.parse(rawJson) as Record<string, unknown>;
}
