import type {
  Task,
  TaskResult,
  RalphCycle,
  RalphLog,
  RuleContext,
  SkillContext,
} from "./beads.types";
import { beadsService } from "./beads.service";
import { openaiService } from "../server/modules/ai";

/**
 * Ralph - Autonomous Task Executor for JSRVIS
 *
 * Executes tasks from Beads following .cursor/rules and .cursor/skills context.
 * Works in cycles, reports results back to Beads.
 */
export class RalphService {
  private activeCycles: Map<string, RalphCycle> = new Map();
  private isRunning: boolean = false;

  /**
   * Execute a single task
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const startTime = Date.now();
    const cycle = this.startCycle(taskId);

    try {
      // Get task context from Beads
      const context = await beadsService.getTaskContext(taskId);
      if (!context) {
        throw new Error(`Task ${taskId} not found`);
      }

      const { task, rules, skill, guidelines } = context;

      this.log(cycle, "info", `Starting execution: ${task.title}`);
      this.log(cycle, "info", `Guidelines: ${guidelines.length} rules loaded`);

      // Update task status
      beadsService.updateTaskStatus(taskId, "in_progress");

      // Build execution prompt
      const executionPrompt = this.buildExecutionPrompt(
        task,
        rules,
        skill,
        guidelines,
      );
      this.log(cycle, "debug", "Execution prompt built");

      // Execute with AI
      const result = await this.executeWithAI(executionPrompt, task, cycle);

      // Update task with result
      const taskResult: TaskResult = {
        success: result.success,
        output: result.output,
        filesModified: result.filesModified || [],
        errors: result.errors,
        duration: Date.now() - startTime,
      };

      beadsService.setTaskResult(taskId, taskResult);
      this.completeCycle(cycle, "completed");

      this.log(
        cycle,
        "info",
        `Completed: ${task.title} (${taskResult.success ? "success" : "failed"})`,
      );

      return taskResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.log(cycle, "error", `Execution failed: ${errorMessage}`);
      this.completeCycle(cycle, "failed");

      const taskResult: TaskResult = {
        success: false,
        output: "",
        filesModified: [],
        errors: [errorMessage],
        duration: Date.now() - startTime,
      };

      beadsService.setTaskResult(taskId, taskResult);
      return taskResult;
    }
  }

  /**
   * Execute all pending tasks in order
   */
  async executeAllPending(): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    this.isRunning = true;

    while (this.isRunning) {
      const nextTask = beadsService.getNextTask();
      if (!nextTask) break;

      const result = await this.executeTask(nextTask.id);
      results.set(nextTask.id, result);

      // Small delay between tasks
      await this.delay(100);
    }

    this.isRunning = false;
    return results;
  }

  /**
   * Stop execution loop
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Get active cycles
   */
  getActiveCycles(): RalphCycle[] {
    return Array.from(this.activeCycles.values());
  }

  /**
   * Get cycle by ID
   */
  getCycle(cycleId: string): RalphCycle | undefined {
    return this.activeCycles.get(cycleId);
  }

  /**
   * Get cycle logs
   */
  getCycleLogs(cycleId: string): RalphLog[] {
    const cycle = this.activeCycles.get(cycleId);
    return cycle?.logs || [];
  }

  // =====================
  // Private methods
  // =====================

  private startCycle(taskId: string): RalphCycle {
    const cycle: RalphCycle = {
      id: `cycle-${Date.now()}`,
      taskId,
      startedAt: new Date(),
      status: "running",
      logs: [],
    };

    this.activeCycles.set(cycle.id, cycle);
    return cycle;
  }

  private completeCycle(cycle: RalphCycle, status: RalphCycle["status"]): void {
    cycle.completedAt = new Date();
    cycle.status = status;
    this.activeCycles.set(cycle.id, cycle);
  }

  private log(
    cycle: RalphCycle,
    level: RalphLog["level"],
    message: string,
    data?: unknown,
  ): void {
    const logEntry: RalphLog = {
      timestamp: new Date(),
      level,
      message,
      data,
    };

    cycle.logs.push(logEntry);
    console.log(`[Ralph][${level.toUpperCase()}] ${message}`);
  }

  private buildExecutionPrompt(
    task: Task,
    rules: RuleContext[],
    skill: SkillContext | null,
    guidelines: string[],
  ): string {
    let prompt = `# Task Execution\n\n`;
    prompt += `## Task\n**${task.title}**\n\n${task.description}\n\n`;

    if (task.criteria.length > 0) {
      prompt += `## Acceptance Criteria\n`;
      task.criteria.forEach((c, i) => {
        prompt += `${i + 1}. ${c}\n`;
      });
      prompt += "\n";
    }

    if (task.targetFiles && task.targetFiles.length > 0) {
      prompt += `## Target Files\n`;
      task.targetFiles.forEach((f) => {
        prompt += `- ${f}\n`;
      });
      prompt += "\n";
    }

    if (guidelines.length > 0) {
      prompt += `## Guidelines (from project rules)\n`;
      guidelines.slice(0, 15).forEach((g) => {
        prompt += `- ${g}\n`;
      });
      prompt += "\n";
    }

    if (skill) {
      prompt += `## Relevant Skill: ${skill.name}\n`;
      prompt += skill.description + "\n\n";
    }

    if (rules.length > 0) {
      prompt += `## Applied Rules\n`;
      rules.forEach((r) => {
        prompt += `- **${r.name}**: ${r.description || r.keyPoints[0] || "Project rule"}\n`;
      });
      prompt += "\n";
    }

    prompt += `## Instructions\n`;
    prompt += `Analyze this task and provide:\n`;
    prompt += `1. A step-by-step execution plan\n`;
    prompt += `2. Expected changes/outputs\n`;
    prompt += `3. Any potential issues or blockers\n`;
    prompt += `4. Verification steps\n`;

    return prompt;
  }

  private async executeWithAI(
    prompt: string,
    task: Task,
    cycle: RalphCycle,
  ): Promise<{
    success: boolean;
    output: string;
    filesModified?: string[];
    errors?: string[];
  }> {
    try {
      this.log(cycle, "info", "Sending to AI for analysis...");

      const completion = await openaiService.createChatCompletion({
        messages: [
          {
            role: "system",
            content: `You are Ralph, an autonomous task executor for the JSRVIS project.
You follow project rules from .cursor/rules/ and use skills from .cursor/skills/.
Your goal is to analyze tasks and provide clear execution plans.

When analyzing a task:
1. Break it down into concrete steps
2. Identify files that need to be modified
3. Consider project guidelines and constraints
4. Provide verification criteria

Respond in a structured format with:
- PLAN: numbered steps
- FILES: list of files to modify
- RISKS: potential issues
- VERIFICATION: how to verify success`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "gpt-4o",
        maxTokens: 2048,
      });

      const response = completion.choices[0]?.message?.content || "";
      this.log(cycle, "info", "AI analysis complete");

      // Parse response to extract structured data
      const filesModified = this.extractFiles(response);
      const hasErrors =
        response.toLowerCase().includes("error") ||
        response.toLowerCase().includes("cannot") ||
        response.toLowerCase().includes("impossible");

      return {
        success: !hasErrors,
        output: response,
        filesModified,
        errors: hasErrors
          ? ["Task may have issues - review AI analysis"]
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "AI execution failed";
      this.log(cycle, "error", errorMessage);

      return {
        success: false,
        output: "",
        errors: [errorMessage],
      };
    }
  }

  private extractFiles(text: string): string[] {
    const files: string[] = [];

    // Match file paths
    const filePatterns = [
      /`([^`]+\.[a-z]+)`/gi, // backtick paths
      /(?:^|\s)([\w./\\-]+\.(?:ts|tsx|js|jsx|json|md|mdc))/gm, // direct paths
    ];

    for (const pattern of filePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const file = match[1];
        if (file && !files.includes(file) && !file.includes("example")) {
          files.push(file);
        }
      }
    }

    return files.slice(0, 20); // Limit to 20 files
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const ralphService = new RalphService();
