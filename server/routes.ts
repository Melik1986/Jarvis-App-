import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerBeadsRoutes } from "../beads";

export async function registerRoutes(app: Express): Promise<Server> {
  registerChatRoutes(app);
  registerImageRoutes(app);
  registerAudioRoutes(app);
  registerBeadsRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
