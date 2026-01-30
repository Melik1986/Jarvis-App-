---
name: beads-ralph
description: Provides context for Beads (task manager) and Ralph (autonomous executor) system. Use when managing tasks, planning work, automating execution, or asking about task management in JSRVIS. Reads and applies rules from .cursor/rules/ automatically.
---

# Beads + Ralph — Task Management & Autonomous Execution

## Purpose

Integrated system for managing development tasks with deep connection to `.cursor/rules` and `.cursor/skills`. Beads manages tasks, Ralph executes them autonomously following project guidelines.

## Components

| Component | Role | Integration |
|-----------|------|-------------|
| **Beads** | Task Manager | Creates tasks, auto-links relevant rules/skills |
| **Ralph** | Autonomous Executor | Executes tasks following guidelines from rules |
| **RulesParser** | Context Loader | Parses .cursor/rules/*.mdc and .cursor/skills/ |

## How Integration Works

### 1. Task Creation (Beads)

When you create a task, Beads automatically:
- Scans all `.cursor/rules/*.mdc` files
- Finds rules matching task keywords
- Scans `.cursor/skills/*/SKILL.md`
- Links relevant skill to task
- Extracts guidelines from rules

```typescript
// Example: creating a task
const task = await beadsService.createTask({
  title: "Add Supabase Auth",
  description: "Implement Phone OTP authentication"
});
// Automatically links: auth module rules, project-context.mdc
```

### 2. Task Execution (Ralph)

Ralph uses the linked context:
1. Loads all related rules
2. Extracts key guidelines
3. Builds execution prompt with project context
4. Executes with AI following the guidelines
5. Reports results back to Beads

### 3. Context Flow

```
.cursor/rules/*.mdc ─┐
                     ├─► RulesParser ─► Beads ─► Task with context
.cursor/skills/*     ─┘                              │
                                                     ▼
                                                   Ralph
                                                     │
                                              (executes with
                                               project rules)
```

## API Reference

### Beads Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/beads/context` | Get all rules + skills |
| GET | `/api/beads/tasks` | List all tasks |
| GET | `/api/beads/tasks/:id` | Get task by ID |
| GET | `/api/beads/tasks/:id/context` | Get task with rules/skill |
| POST | `/api/beads/tasks` | Create task |
| POST | `/api/beads/tasks/plan` | Create from plan array |
| PATCH | `/api/beads/tasks/:id/status` | Update status |
| GET | `/api/beads/summary` | Get stats |

### Ralph Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ralph/execute/:taskId` | Execute single task |
| POST | `/api/ralph/execute-all` | Execute all pending |
| POST | `/api/ralph/stop` | Stop execution |
| GET | `/api/ralph/cycles` | Get active cycles |
| GET | `/api/ralph/cycles/:id/logs` | Get cycle logs |

## Task Properties

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
  priority: "critical" | "high" | "medium" | "low";
  
  // Auto-populated from .cursor/
  relatedRules: string[];  // e.g. ["project-context", "tech-stack-expert"]
  relatedSkill?: string;   // e.g. "jarvis-1c-project"
  
  // Dependencies
  blockedBy?: string[];    // Task IDs this depends on
  blocks?: string[];       // Tasks that depend on this
  
  // Execution
  criteria: string[];      // Acceptance criteria
  targetFiles?: string[];  // Files to modify
  result?: TaskResult;     // Ralph execution result
}
```

## Usage Patterns

### Create Single Task

```typescript
import { beadsService } from "./server/modules/beads";

const task = await beadsService.createTask({
  title: "Implement RAG search",
  description: "Add Qdrant vector search to chat",
  priority: "high",
  criteria: [
    "Search returns relevant documents",
    "Context injected into LLM prompt"
  ]
});
// task.relatedRules will contain ["project-context", "tech-stack-expert"]
// task.relatedSkill will be "jarvis-1c-project"
```

### Create Plan

```typescript
const tasks = await beadsService.createTasksFromPlan([
  { title: "Create Qdrant module", priority: "critical" },
  { title: "Add embeddings service", dependsOn: ["Create Qdrant module"] },
  { title: "Integrate into chat", dependsOn: ["Add embeddings service"] }
]);
```

### Execute with Ralph

```typescript
import { ralphService } from "./server/modules/beads";

// Single task
const result = await ralphService.executeTask(taskId);

// All pending (background)
ralphService.executeAllPending();
```

## Related Rules

- `project-context.mdc` — Core project modules and architecture
- `tech-stack-expert.mdc` — Stack-specific best practices
- `mcp-tools-subagent.mdc` — MCP integration patterns
- `beads-ralph.mdc` — This system's API and patterns

## When to Use

Use Beads + Ralph when:
- Planning multi-step implementation
- Automating task execution with project rules
- Tracking progress on complex features
- Ensuring work follows project guidelines
- Managing dependencies between tasks
