import { randomUUID } from "crypto";
import type {
  Task,
  TaskStatus,
  TaskPriority,
  BeadsConfig,
  ProjectContext,
  RuleContext,
  SkillContext,
} from "./beads.types";
import { rulesParser } from "./rules-parser";

/**
 * Beads - Task Manager for JSRVIS
 *
 * Manages tasks with deep integration into .cursor/rules and .cursor/skills.
 * Creates, prioritizes, and tracks tasks based on project context.
 */
export class BeadsService {
  private tasks: Map<string, Task> = new Map();
  private projectContext: ProjectContext | null = null;
  private config: BeadsConfig;

  constructor(config?: Partial<BeadsConfig>) {
    this.config = {
      cursorPath: config?.cursorPath || ".cursor",
      autoLoadRules: config?.autoLoadRules ?? true,
      autoLoadSkills: config?.autoLoadSkills ?? true,
    };
  }

  /**
   * Initialize Beads with project context
   */
  async initialize(): Promise<void> {
    this.projectContext = await rulesParser.loadProjectContext();
    console.log(
      `[Beads] Initialized with ${this.projectContext.rules.length} rules and ${this.projectContext.skills.length} skills`,
    );
  }

  /**
   * Get project context (rules + skills)
   */
  getProjectContext(): ProjectContext | null {
    return this.projectContext;
  }

  /**
   * Create a new task with rule/skill context
   */
  async createTask(params: {
    title: string;
    description: string;
    priority?: TaskPriority;
    criteria?: string[];
    targetFiles?: string[];
    blockedBy?: string[];
  }): Promise<Task> {
    // Find relevant rules and skills based on task description
    const relatedRules = await this.findRelevantRules(
      params.title + " " + params.description,
    );
    const relatedSkill = await this.findRelevantSkill(
      params.title + " " + params.description,
    );

    const task: Task = {
      id: randomUUID(),
      title: params.title,
      description: params.description,
      status: "pending",
      priority: params.priority || "medium",
      relatedRules: relatedRules.map((r) => r.name),
      relatedSkill: relatedSkill?.name,
      blockedBy: params.blockedBy,
      criteria: params.criteria || [],
      targetFiles: params.targetFiles,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.updateBlockingRelationships();

    console.log(`[Beads] Created task: ${task.title} (${task.id})`);
    console.log(
      `[Beads] Related rules: ${task.relatedRules.join(", ") || "none"}`,
    );
    console.log(`[Beads] Related skill: ${task.relatedSkill || "none"}`);

    return task;
  }

  /**
   * Create multiple tasks from a plan
   */
  async createTasksFromPlan(
    plan: {
      title: string;
      description: string;
      priority?: TaskPriority;
      criteria?: string[];
      dependsOn?: string[]; // titles of tasks this depends on
    }[],
  ): Promise<Task[]> {
    const createdTasks: Task[] = [];
    const titleToId = new Map<string, string>();

    // First pass: create all tasks
    for (const item of plan) {
      const task = await this.createTask({
        title: item.title,
        description: item.description,
        priority: item.priority,
        criteria: item.criteria,
      });
      createdTasks.push(task);
      titleToId.set(item.title, task.id);
    }

    // Second pass: set up dependencies
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      if (item.dependsOn && item.dependsOn.length > 0) {
        const blockedBy = item.dependsOn
          .map((title) => titleToId.get(title))
          .filter((id): id is string => !!id);

        if (blockedBy.length > 0) {
          const task = createdTasks[i];
          task.blockedBy = blockedBy;
          task.status = "blocked";
          this.tasks.set(task.id, task);
        }
      }
    }

    this.updateBlockingRelationships();
    return createdTasks;
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter((t) => t.status === status);
  }

  /**
   * Get next executable task (highest priority, not blocked)
   */
  getNextTask(): Task | null {
    const pendingTasks = this.getTasksByStatus("pending");
    if (pendingTasks.length === 0) return null;

    // Sort by priority
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    pendingTasks.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
    return pendingTasks[0];
  }

  /**
   * Update task status
   */
  updateTaskStatus(id: string, status: TaskStatus): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = status;
    task.updatedAt = new Date();

    if (status === "completed") {
      task.completedAt = new Date();
      this.unblockDependentTasks(id);
    }

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Set task result (from Ralph execution)
   */
  setTaskResult(id: string, result: Task["result"]): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.result = result;
    task.status = result?.success ? "completed" : "pending";
    task.updatedAt = new Date();

    if (result?.success) {
      task.completedAt = new Date();
      this.unblockDependentTasks(id);
    }

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Get context for task execution (rules + skill)
   */
  async getTaskContext(taskId: string): Promise<{
    task: Task;
    rules: RuleContext[];
    skill: SkillContext | null;
    guidelines: string[];
  } | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const rules = await Promise.all(
      task.relatedRules.map((name) => rulesParser.getRuleByName(name)),
    );

    const skill = task.relatedSkill
      ? await rulesParser.getSkillByName(task.relatedSkill)
      : null;

    // Extract guidelines from rules
    const guidelines: string[] = [];
    for (const rule of rules.filter((r): r is RuleContext => r !== null)) {
      guidelines.push(...rule.keyPoints);
    }

    return {
      task,
      rules: rules.filter((r): r is RuleContext => r !== null),
      skill,
      guidelines: [...new Set(guidelines)],
    };
  }

  /**
   * Generate task summary for reporting
   */
  getSummary(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    completionRate: number;
  } {
    const tasks = this.getAllTasks();
    const total = tasks.length;

    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
      cancelled: 0,
    };

    const byPriority: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const task of tasks) {
      byStatus[task.status]++;
      byPriority[task.priority]++;
    }

    const completionRate = total > 0 ? (byStatus.completed / total) * 100 : 0;

    return { total, byStatus, byPriority, completionRate };
  }

  /**
   * Clear all tasks
   */
  clearTasks(): void {
    this.tasks.clear();
  }

  // =====================
  // Private helpers
  // =====================

  private async findRelevantRules(text: string): Promise<RuleContext[]> {
    if (!this.projectContext) return [];

    const lowerText = text.toLowerCase();
    return this.projectContext.rules.filter((rule) => {
      // Check if always applied
      if (rule.alwaysApply) return true;

      // Check if any keyword matches
      const keywords = [
        rule.name,
        ...(rule.keyPoints || []),
        rule.description || "",
      ].map((k) => k.toLowerCase());

      return keywords.some(
        (kw) => lowerText.includes(kw) || kw.includes(lowerText.slice(0, 20)),
      );
    });
  }

  private async findRelevantSkill(text: string): Promise<SkillContext | null> {
    if (!this.projectContext) return null;

    const lowerText = text.toLowerCase();

    for (const skill of this.projectContext.skills) {
      const triggers = skill.triggers.map((t) => t.toLowerCase());
      if (triggers.some((t) => lowerText.includes(t))) {
        return skill;
      }
    }

    return null;
  }

  private updateBlockingRelationships(): void {
    for (const task of this.tasks.values()) {
      if (task.blockedBy && task.blockedBy.length > 0) {
        for (const blockerId of task.blockedBy) {
          const blocker = this.tasks.get(blockerId);
          if (blocker) {
            blocker.blocks = blocker.blocks || [];
            if (!blocker.blocks.includes(task.id)) {
              blocker.blocks.push(task.id);
            }
          }
        }
      }
    }
  }

  private unblockDependentTasks(completedTaskId: string): void {
    for (const task of this.tasks.values()) {
      if (task.blockedBy?.includes(completedTaskId)) {
        task.blockedBy = task.blockedBy.filter((id) => id !== completedTaskId);

        // Check if all blockers are resolved
        const stillBlocked = task.blockedBy.some((id) => {
          const blocker = this.tasks.get(id);
          return blocker && blocker.status !== "completed";
        });

        if (!stillBlocked && task.status === "blocked") {
          task.status = "pending";
        }
      }
    }
  }
}

// Singleton instance
export const beadsService = new BeadsService();
