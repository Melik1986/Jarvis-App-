import { Injectable, Inject } from "@nestjs/common";
import { DATABASE_CONNECTION, Database } from "../../db/db.module";
import { skills, type Skill, type InsertSkill } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { SandboxExecutorService } from "./sandbox-executor.service";

@Injectable()
export class SkillService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: Database,
    private sandbox: SandboxExecutorService,
  ) {}

  async getSkills(userId: string): Promise<Skill[]> {
    if (!this.db) return [];
    return this.db.select().from(skills).where(eq(skills.userId, userId));
  }

  async createSkill(skill: InsertSkill): Promise<Skill | null> {
    if (!this.db) return null;
    const [newSkill] = await this.db.insert(skills).values(skill).returning();
    return newSkill;
  }

  async updateSkill(
    id: string,
    userId: string,
    skill: Partial<Skill>,
  ): Promise<Skill | null> {
    if (!this.db) return null;
    const [updatedSkill] = await this.db
      .update(skills)
      .set(skill)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)))
      .returning();
    return updatedSkill;
  }

  async deleteSkill(id: string, userId: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async executeSkill(
    id: string,
    userId: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.db) throw new Error("Database not connected");

    const [skill] = await this.db
      .select()
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)))
      .limit(1);

    if (!skill) throw new Error("Skill not found");
    if (!skill.enabled) throw new Error("Skill is disabled");

    return this.sandbox.execute(skill.code, input);
  }
}
