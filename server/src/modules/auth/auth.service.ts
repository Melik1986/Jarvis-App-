import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { DATABASE_CONNECTION, Database } from "../../db/db.module";
import { AuthUser, AuthSession, JwtPayload } from "./auth.types";

import * as schema from "../../../../shared/schema";

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

  constructor(
    private configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private db: Database,
  ) {
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
        console.error("Token exchange failed:", await tokenResponse.text());
        return { success: false, error: "Token exchange failed" };
      }

      const tokenData = await tokenResponse.json();
      const userInfo = tokenData.user as ReplitUserInfo;

      if (!userInfo || !userInfo.email) {
        return { success: false, error: "Invalid user data from Replit" };
      }

      let user = await this.findUserByEmail(userInfo.email);

      if (!user) {
        user = await this.createUser({
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split("@")[0],
          picture: userInfo.picture,
          replitId: userInfo.id,
        });
      } else {
        user = await this.updateUserProfile(user.id, {
          name: userInfo.name || user.name,
          picture: userInfo.picture || user.picture,
          replitId: userInfo.id,
        });
      }

      const session = await this.createSession({
        id: user.id,
        email: user.email,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          replitId: user.replitId,
        },
        session,
      };
    } catch (error) {
      console.error("Replit auth error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  async authenticateFromSession(sessionUser: any): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      if (!sessionUser || !sessionUser.email) {
        return { success: false, error: "No session user" };
      }

      let user = await this.findUserByEmail(sessionUser.email);

      if (!user) {
        user = await this.createUser({
          email: sessionUser.email,
          name: sessionUser.name || sessionUser.email.split("@")[0],
          picture: sessionUser.picture,
          replitId: sessionUser.id,
        });
      }

      const session = await this.createSession({
        id: user.id,
        email: user.email,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          replitId: user.replitId,
        },
        session,
      };
    } catch (error) {
      console.error("Session auth error:", error);
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
      const sessionData = await this.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.refreshToken, refreshToken))
        .limit(1);

      if (!sessionData.length) {
        return { success: false, error: "Invalid refresh token" };
      }

      const existingSession = sessionData[0];

      if (new Date(existingSession.expiresAt) < new Date()) {
        await this.db
          .delete(schema.sessions)
          .where(eq(schema.sessions.id, existingSession.id));
        return { success: false, error: "Refresh token expired" };
      }

      const userData = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, existingSession.userId))
        .limit(1);

      if (!userData.length) {
        return { success: false, error: "User not found" };
      }

      const user = userData[0];

      await this.db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, existingSession.id));

      const newSession = await this.createSession({
        id: user.id,
        email: user.email,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          replitId: user.replitId,
        },
        session: newSession,
      };
    } catch (error) {
      console.error("Refresh session error:", error);
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
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;

      const userData = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub))
        .limit(1);

      if (!userData.length) {
        return { valid: false };
      }

      const user = userData[0];
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          replitId: user.replitId,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    try {
      await this.db
        .delete(schema.sessions)
        .where(eq(schema.sessions.refreshToken, refreshToken));
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async getMe(userId: string): Promise<AuthUser | null> {
    const userData = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!userData.length) {
      return null;
    }

    const user = userData[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      replitId: user.replitId,
    };
  }

  private async findUserByEmail(email: string) {
    const users = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return users[0] || null;
  }

  private async createUser(data: {
    email: string;
    name: string;
    picture?: string;
    replitId?: string;
  }) {
    const result = await this.db
      .insert(schema.users)
      .values({
        email: data.email,
        name: data.name,
        picture: data.picture || null,
        replitId: data.replitId || null,
      })
      .returning();
    return (result as any[])[0];
  }

  private async updateUserProfile(
    userId: string,
    data: { name?: string; picture?: string; replitId?: string },
  ) {
    const result = await this.db
      .update(schema.users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  private async createSession(user: {
    id: string;
    email: string;
  }): Promise<AuthSession> {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry },
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: "refresh" },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.db.insert(schema.sessions).values({
      userId: user.id,
      refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60,
    };
  }
}
