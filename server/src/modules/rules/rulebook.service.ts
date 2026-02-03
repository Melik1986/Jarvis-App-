import { Injectable, Inject } from "@nestjs/common";
import { DATABASE_CONNECTION, Database } from "../../db/db.module";
import { rules, type Rule, type InsertRule } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { AppLogger } from "../../utils/logger";

@Injectable()
export class RulebookService {
  constructor(@Inject(DATABASE_CONNECTION) private db: Database) {}

  async getRules(userId: string): Promise<Rule[]> {
    if (!this.db) return [];
    return this.db
      .select()
      .from(rules)
      .where(eq(rules.userId, userId))
      .orderBy(rules.priority);
  }

  async createRule(rule: InsertRule): Promise<Rule | null> {
    if (!this.db) return null;
    const [newRule] = await this.db.insert(rules).values(rule).returning();
    return newRule;
  }

  async updateRule(
    id: string,
    userId: string,
    rule: Partial<Rule>,
  ): Promise<Rule | null> {
    if (!this.db) return null;
    const [updatedRule] = await this.db
      .update(rules)
      .set(rule)
      .where(and(eq(rules.id, id), eq(rules.userId, userId)))
      .returning();
    return updatedRule;
  }

  async deleteRule(id: string, userId: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(rules)
      .where(and(eq(rules.id, id), eq(rules.userId, userId)))
      .returning();
    return result.length > 0;
  }

  /**
   * Validate a tool call against the user's rules.
   * Returns validation result: { allowed: boolean, action: string, message?: string }
   */
  async validateToolCall(
    userId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const userRules = await this.getRules(userId);
    const activeRules = userRules.filter((r) => r.enabled);

    for (const rule of activeRules) {
      try {
        const condition = JSON.parse(rule.condition) as {
          tool?: string;
          field?: string;
          operator?: string;
          value?: unknown;
        };

        // Basic condition check: tool name match
        if (condition.tool && condition.tool !== toolName) continue;

        // Field value check
        if (condition.field && args[condition.field] !== undefined) {
          const val = args[condition.field];
          let match = false;

          switch (condition.operator) {
            case "<":
              match =
                typeof val === "number" && typeof condition.value === "number"
                  ? val < condition.value
                  : false;
              break;
            case ">":
              match =
                typeof val === "number" && typeof condition.value === "number"
                  ? val > condition.value
                  : false;
              break;
            case "==":
              match = val === condition.value;
              break;
            case "!=":
              match = val !== condition.value;
              break;
            case "contains":
              match = String(val).includes(String(condition.value));
              break;
          }

          if (match) {
            AppLogger.warn(
              `Rule violation: ${rule.name} for tool ${toolName}`,
              undefined,
              "Rulebook",
            );
            return {
              allowed: rule.action !== "reject",
              action: rule.action,
              message: rule.message || `Нарушено правило: ${rule.name}`,
              ruleId: rule.id,
            };
          }
        }
      } catch (error) {
        AppLogger.error(
          `Error parsing rule condition: ${rule.id}`,
          error,
          "Rulebook",
        );
      }
    }

    return { allowed: true, action: "allow" };
  }
}
