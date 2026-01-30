import type { Express, Request, Response } from "express";
import { beadsService } from "./beads.service";
import { ralphService } from "./ralph.service";
import type { TaskPriority } from "./beads.types";

/**
 * Register Beads + Ralph API routes
 */
export function registerBeadsRoutes(app: Express): void {
  // Initialize Beads on startup
  beadsService.initialize().catch(console.error);

  // =====================
  // BEADS ROUTES (Task Management)
  // =====================

  // Get project context (rules + skills)
  app.get("/api/beads/context", async (req: Request, res: Response) => {
    try {
      const context = beadsService.getProjectContext();
      if (!context) {
        await beadsService.initialize();
      }
      res.json(beadsService.getProjectContext());
    } catch (error) {
      console.error("Error getting context:", error);
      res.status(500).json({ error: "Failed to get project context" });
    }
  });

  // Get all tasks
  app.get("/api/beads/tasks", (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const tasks = status
        ? beadsService.getTasksByStatus(status as any)
        : beadsService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error getting tasks:", error);
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  // Get task by ID
  app.get("/api/beads/tasks/:id", (req: Request, res: Response) => {
    try {
      const task = beadsService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  });

  // Get task context (with rules + skill)
  app.get(
    "/api/beads/tasks/:id/context",
    async (req: Request, res: Response) => {
      try {
        const context = await beadsService.getTaskContext(req.params.id);
        if (!context) {
          return res.status(404).json({ error: "Task not found" });
        }
        res.json(context);
      } catch (error) {
        console.error("Error getting task context:", error);
        res.status(500).json({ error: "Failed to get task context" });
      }
    },
  );

  // Create a task
  app.post("/api/beads/tasks", async (req: Request, res: Response) => {
    try {
      const { title, description, priority, criteria, targetFiles, blockedBy } =
        req.body;

      if (!title || !description) {
        return res
          .status(400)
          .json({ error: "Title and description are required" });
      }

      const task = await beadsService.createTask({
        title,
        description,
        priority: priority as TaskPriority,
        criteria,
        targetFiles,
        blockedBy,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Create tasks from plan
  app.post("/api/beads/tasks/plan", async (req: Request, res: Response) => {
    try {
      const { plan } = req.body;

      if (!Array.isArray(plan) || plan.length === 0) {
        return res
          .status(400)
          .json({ error: "Plan must be a non-empty array" });
      }

      const tasks = await beadsService.createTasksFromPlan(plan);
      res.status(201).json(tasks);
    } catch (error) {
      console.error("Error creating tasks from plan:", error);
      res.status(500).json({ error: "Failed to create tasks from plan" });
    }
  });

  // Update task status
  app.patch("/api/beads/tasks/:id/status", (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const task = beadsService.updateTaskStatus(req.params.id, status);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // Get summary
  app.get("/api/beads/summary", (req: Request, res: Response) => {
    try {
      const summary = beadsService.getSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error getting summary:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });

  // Clear all tasks
  app.delete("/api/beads/tasks", (req: Request, res: Response) => {
    try {
      beadsService.clearTasks();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing tasks:", error);
      res.status(500).json({ error: "Failed to clear tasks" });
    }
  });

  // =====================
  // RALPH ROUTES (Execution)
  // =====================

  // Execute a single task
  app.post(
    "/api/ralph/execute/:taskId",
    async (req: Request, res: Response) => {
      try {
        const result = await ralphService.executeTask(req.params.taskId);
        res.json(result);
      } catch (error) {
        console.error("Error executing task:", error);
        res.status(500).json({ error: "Failed to execute task" });
      }
    },
  );

  // Execute all pending tasks
  app.post("/api/ralph/execute-all", async (req: Request, res: Response) => {
    try {
      // Start execution in background
      ralphService.executeAllPending().catch(console.error);
      res.json({ message: "Execution started", status: "running" });
    } catch (error) {
      console.error("Error starting execution:", error);
      res.status(500).json({ error: "Failed to start execution" });
    }
  });

  // Stop execution
  app.post("/api/ralph/stop", (req: Request, res: Response) => {
    try {
      ralphService.stop();
      res.json({ message: "Execution stopped" });
    } catch (error) {
      console.error("Error stopping execution:", error);
      res.status(500).json({ error: "Failed to stop execution" });
    }
  });

  // Get active cycles
  app.get("/api/ralph/cycles", (req: Request, res: Response) => {
    try {
      const cycles = ralphService.getActiveCycles();
      res.json(cycles);
    } catch (error) {
      console.error("Error getting cycles:", error);
      res.status(500).json({ error: "Failed to get cycles" });
    }
  });

  // Get cycle logs
  app.get("/api/ralph/cycles/:cycleId/logs", (req: Request, res: Response) => {
    try {
      const logs = ralphService.getCycleLogs(req.params.cycleId);
      res.json(logs);
    } catch (error) {
      console.error("Error getting cycle logs:", error);
      res.status(500).json({ error: "Failed to get cycle logs" });
    }
  });

  // Get next task
  app.get("/api/ralph/next-task", (req: Request, res: Response) => {
    try {
      const task = beadsService.getNextTask();
      res.json(task || { message: "No pending tasks" });
    } catch (error) {
      console.error("Error getting next task:", error);
      res.status(500).json({ error: "Failed to get next task" });
    }
  });
}
