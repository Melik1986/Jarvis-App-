import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.types";
import { supabaseService } from "./supabase.service";

/**
 * Authentication middleware - requires valid token.
 * Attaches user to request if authenticated.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Unauthorized: Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const user = await supabaseService.verifyToken(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res
      .status(500)
      .json({ error: "Internal server error during authentication" });
  }
}

/**
 * Optional authentication middleware - doesn't require token.
 * Attaches user to request if token is provided and valid.
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No token provided, continue without user
    next();
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const user = await supabaseService.verifyToken(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
    next();
  } catch (error) {
    // Token verification failed, but continue without user
    console.warn("Optional auth: token verification failed", error);
    next();
  }
}
