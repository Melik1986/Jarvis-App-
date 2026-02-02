import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { AuthUser, AuthSession } from "./auth.types";
import { AppLogger } from "../../utils/logger";

interface ReplitUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = "24h";
  private readonly refreshTokenExpiry = "30d";

  constructor(private configService: ConfigService) {
    this.jwtSecret =
      this.configService.get("SESSION_SECRET") ||
      "axon-secret-key-change-in-production";
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const replitDomain =
      process.env.REPLIT_DEV_DOMAIN ||
      process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = `https://${replitDomain}`;

    const params = new URLSearchParams({
      response_type: "code",
      redirect_uri: redirectUri,
      state: state,
    });

    return `${baseUrl}/__replit/auth?${params.toString()}`;
  }

  async authenticateWithReplitCallback(
    code: string,
    state: string,
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const replitDomain =
        process.env.REPLIT_DEV_DOMAIN ||
        process.env.REPLIT_DOMAINS?.split(",")[0];
      const tokenUrl = `https://${replitDomain}/__replit/auth/token`;

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!tokenResponse.ok) {
        AppLogger.error("Token exchange failed:", await tokenResponse.text());
        return { success: false, error: "Token exchange failed" };
      }

      const tokenData = await tokenResponse.json();
      const userInfo = tokenData.user as ReplitUserInfo;

      if (!userInfo || !userInfo.email) {
        return { success: false, error: "Invalid user data from Replit" };
      }

      // Stateless: Create user object from Replit data
      const user: AuthUser = {
        id: `replit-${userInfo.id}`,
        email: userInfo.email,
        name: userInfo.name || userInfo.email.split("@")[0],
        picture: userInfo.picture || null,
        replitId: userInfo.id,
      };

      const session = this.createSession(user);

      return {
        success: true,
        user,
        session,
      };
    } catch (error) {
      AppLogger.error("Replit auth error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  async authenticateFromSession(
    sessionUser: Partial<AuthUser> | null | undefined,
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      if (!sessionUser?.email) {
        return { success: false, error: "No session user" };
      }

      const user: AuthUser = {
        id: sessionUser.id || `user-${Date.now()}`,
        email: sessionUser.email,
        name: sessionUser.name || sessionUser.email.split("@")[0],
        picture: sessionUser.picture || null,
        replitId: sessionUser.replitId || null,
      };

      const session = this.createSession(user);

      return {
        success: true,
        user,
        session,
      };
    } catch (error) {
      AppLogger.error("Session auth error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  async refreshSession(refreshToken: string): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const payload = jwt.verify(
        refreshToken,
        this.jwtSecret,
      ) as jwt.JwtPayload & {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
        replitId?: string;
      };

      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name || "User",
        picture: payload.picture,
        replitId: payload.replitId,
      };

      const newSession = this.createSession(user);

      return {
        success: true,
        user,
        session: newSession,
      };
    } catch (error) {
      AppLogger.error("Refresh session error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh session",
      };
    }
  }

  async validateToken(
    token: string,
  ): Promise<{ valid: boolean; user?: AuthUser }> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload & {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
        replitId?: string;
      };

      return {
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          replitId: payload.replitId,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    // Stateless logout is client-side only
    return { success: true };
  }

  // Helper for Controller compatibility
  async getMe(userId: string): Promise<AuthUser | null> {
    // This should ideally not be used in stateless mode without passing the full user object.
    // But since the controller uses it, and the controller has req.user,
    // we will update the controller to NOT call this, or pass the user object.
    return null;
  }

  private createSession(user: AuthUser): AuthSession {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      replitId: user.replitId,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
    });

    const refreshToken = jwt.sign(
      { ...payload, type: "refresh" },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60,
    };
  }
}
