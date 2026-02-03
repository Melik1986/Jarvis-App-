import { Injectable } from "@nestjs/common";

@Injectable()
export class CoveWorkflowService {
  /**
   * Determine if a tool call needs a verification step (read before write).
   */
  needsVerification(toolName: string): boolean {
    const writeOps = ["create_invoice", "update_", "delete_", "post_"];
    return writeOps.some((op) => toolName.includes(op));
  }

  /**
   * Get the required read tools to verify state before executing a write tool.
   * This is part of the Chain of Verification (CoVe) pattern.
   */
  getVerificationTools(
    toolName: string,
    args: Record<string, unknown>,
  ): { toolName: string; args: Record<string, unknown> }[] {
    const verifications: { toolName: string; args: Record<string, unknown> }[] =
      [];

    if (toolName.includes("create_invoice")) {
      // For each item in the invoice, check current stock
      const items = Array.isArray(args.items) ? args.items : [];
      for (const item of items) {
        if (
          item &&
          typeof item === "object" &&
          "product_name" in item &&
          typeof item.product_name === "string"
        ) {
          verifications.push({
            toolName: "get_stock",
            args: { product_name: item.product_name },
          });
        }
      }
    } else if (toolName.includes("update_") || toolName.includes("delete_")) {
      // Try to find a corresponding "get_" tool
      const entity = toolName.split("_")[1];
      if (entity) {
        verifications.push({
          toolName: `get_${entity}`,
          args: {
            id:
              typeof args.id === "string"
                ? args.id
                : typeof args.name === "string"
                  ? args.name
                  : "",
          },
        });
      }
    }

    return verifications;
  }
}
