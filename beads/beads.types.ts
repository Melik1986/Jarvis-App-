/**
 * Types for Beads (Task Manager) and Ralph (Autonomous Executor)
 */

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "cancelled";
export type TaskPriority = "critical" | "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;

  /** Related rule files from .cursor/rules/ */
  relatedRules: string[];

  /** Related skill from .cursor/skills/ */
  relatedSkill?: string;

  /** Task this depends on (blocked until completed) */
  blockedBy?: string[];

  /** Tasks that depend on this one */
  blocks?: string[];

  /** Acceptance criteria */
  criteria: string[];

  /** Files to modify */
  targetFiles?: string[];

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Completion timestamp */
  completedAt?: Date;

  /** Ralph execution result */
  result?: TaskResult;
}

export interface TaskResult {
  success: boolean;
  output: string;
  filesModified: string[];
  errors?: string[];
  duration: number;
}

export interface BeadsConfig {
  /** Path to .cursor directory */
  cursorPath: string;

  /** Auto-load rules on init */
  autoLoadRules: boolean;

  /** Auto-load skills on init */
  autoLoadSkills: boolean;
}

export interface RalphCycle {
  id: string;
  taskId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "completed" | "failed" | "cancelled";
  logs: RalphLog[];
}

export interface RalphLog {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: unknown;
}

export interface RuleContext {
  /** Rule file name */
  name: string;

  /** Full path to rule file */
  path: string;

  /** Rule description from frontmatter */
  description?: string;

  /** Glob patterns this rule applies to */
  globs?: string[];

  /** Whether rule is always applied */
  alwaysApply: boolean;

  /** Parsed rule content */
  content: string;

  /** Extracted key points for task generation */
  keyPoints: string[];
}

export interface SkillContext {
  /** Skill name */
  name: string;

  /** Skill directory path */
  path: string;

  /** Skill description */
  description: string;

  /** When to use this skill */
  triggers: string[];

  /** Main SKILL.md content */
  skillContent: string;

  /** Reference content if available */
  referenceContent?: string;

  /** Related rules */
  relatedRules: string[];
}

export interface ProjectContext {
  rules: RuleContext[];
  skills: SkillContext[];
  projectConfig?: {
    name: string;
    description: string;
    modules: string[];
    stack: string[];
  };
}
