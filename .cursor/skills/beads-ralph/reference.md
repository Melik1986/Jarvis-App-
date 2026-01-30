# Beads + Ralph — Technical Reference

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        .cursor/                              │
│  ┌──────────────┐                    ┌──────────────────┐   │
│  │    rules/    │                    │     skills/       │   │
│  │ *.mdc files  │                    │ */SKILL.md        │   │
│  └──────┬───────┘                    └────────┬─────────┘   │
│         │                                     │             │
│         └──────────────┬──────────────────────┘             │
│                        │                                     │
│                        ▼                                     │
│              ┌─────────────────┐                            │
│              │   RulesParser   │                            │
│              │  (rules-parser) │                            │
│              └────────┬────────┘                            │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │     Beads       │
              │ (Task Manager)  │
              └────────┬────────┘
                       │
                       │ getNextTask()
                       │ getTaskContext()
                       ▼
              ┌─────────────────┐
              │     Ralph       │
              │   (Executor)    │
              └────────┬────────┘
                       │
                       │ executeTask()
                       ▼
              ┌─────────────────┐
              │   AI Service    │
              │   (OpenAI)      │
              └─────────────────┘
```

## File Structure

```
server/modules/beads/
├── index.ts           # Module exports
├── beads.types.ts     # TypeScript interfaces
├── beads.service.ts   # Task management (Beads)
├── ralph.service.ts   # Autonomous execution (Ralph)
├── rules-parser.ts    # .cursor/ parser
└── routes.ts          # API endpoints

.cursor/
├── rules/
│   ├── project-context.mdc
│   ├── tech-stack-expert.mdc
│   ├── beads-ralph.mdc        # This system
│   └── ...
└── skills/
    ├── jarvis-1c-project/
    │   ├── SKILL.md
    │   └── reference.md
    └── beads-ralph/           # This skill
        ├── SKILL.md
        └── reference.md
```

## RulesParser Details

### Frontmatter Parsing

Parses YAML frontmatter from .mdc files:

```yaml
---
description: Rule description
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---
```

### Key Points Extraction

Extracts important guidelines:
- Headers (`# ## ###`)
- List items containing MUST, ALWAYS, NEVER
- Short list items (< 100 chars)

### Skill Triggers

Extracts from description:
- "Use when..." patterns
- Keywords: 1C, ERP, voice, RAG, auth, etc.

## Beads Service API

### createTask(params)

```typescript
interface CreateTaskParams {
  title: string;
  description: string;
  priority?: "critical" | "high" | "medium" | "low";
  criteria?: string[];
  targetFiles?: string[];
  blockedBy?: string[];  // Task IDs
}
```

Auto-populates:
- `relatedRules` — from rules matching keywords
- `relatedSkill` — from skill triggers

### createTasksFromPlan(plan)

```typescript
interface PlanItem {
  title: string;
  description: string;
  priority?: TaskPriority;
  criteria?: string[];
  dependsOn?: string[];  // Task TITLES (not IDs)
}
```

Automatically:
- Creates all tasks
- Maps title dependencies to IDs
- Sets `blockedBy` relationships
- Marks blocked tasks as `blocked`

### getTaskContext(taskId)

Returns:
```typescript
{
  task: Task;
  rules: RuleContext[];    // Full rule content
  skill: SkillContext;     // Full skill content
  guidelines: string[];    // Extracted key points
}
```

## Ralph Service API

### executeTask(taskId)

1. Gets context from Beads
2. Builds execution prompt
3. Sends to AI with system prompt
4. Parses response
5. Updates task result

Returns:
```typescript
interface TaskResult {
  success: boolean;
  output: string;
  filesModified: string[];
  errors?: string[];
  duration: number;  // ms
}
```

### executeAllPending()

Background execution loop:
1. Get next pending task (by priority)
2. Execute
3. Repeat until no pending tasks
4. Can be stopped with `stop()`

### Cycle Logging

Each execution creates a `RalphCycle`:
```typescript
interface RalphCycle {
  id: string;
  taskId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "completed" | "failed" | "cancelled";
  logs: RalphLog[];
}
```

## HTTP API Examples

### Create Task
```bash
curl -X POST http://localhost:5000/api/beads/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add RAG to chat",
    "description": "Integrate Qdrant search",
    "priority": "high",
    "criteria": ["Search works", "Context injected"]
  }'
```

### Create Plan
```bash
curl -X POST http://localhost:5000/api/beads/tasks/plan \
  -H "Content-Type: application/json" \
  -d '{
    "plan": [
      {"title": "Create module", "priority": "critical"},
      {"title": "Add tests", "dependsOn": ["Create module"]}
    ]
  }'
```

### Execute Task
```bash
curl -X POST http://localhost:5000/api/ralph/execute/task-id-here
```

### Get Summary
```bash
curl http://localhost:5000/api/beads/summary
# Returns: { total, byStatus, byPriority, completionRate }
```

## Integration with JSRVIS Modules

Beads + Ralph automatically integrates with:

| Module | Detection | Rules Applied |
|--------|-----------|---------------|
| 1C Integration | Keywords: 1С, 1C, OData | `project-context`, `tech-stack-expert` |
| RAG | Keywords: Qdrant, RAG, search | `project-context` |
| Auth | Keywords: Supabase, auth, OTP | `project-context`, `tech-stack-expert` |
| Voice | Keywords: voice, audio, Whisper | `project-context` |
| UI | Keywords: Tamagui, GiftedChat | `tech-stack-expert` |
