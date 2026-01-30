import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { DATABASE_CONNECTION, Database } from "../../db/db.module";
import { AuthUser, AuthSession, GoogleTokenPayload, JwtPayload } from "./auth.types";

const schema = require("../../../../shared/schema");

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = "15m";
  private readonly refreshTokenExpiry = "7d";

  constructor(
    private configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private db: Database,
  ) {
    this.jwtSecret = this.configService.get("SESSION_SECRET") || "axon-secret-key-change-in-production";
  }

  async authenticateWithGoogle(idToken: string): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const googlePayload = await this.verifyGoogleToken(idToken);
      if (!googlePayload) {
        return { success: false, error: "Invalid Google token" };
      }

      let user = await this.findUserByGoogleId(googlePayload.sub);
      
      if (!user) {
        user = await this.findUserByEmail(googlePayload.email);
        if (user) {
          user = await this.updateUserGoogleId(user.id, googlePayload.sub, googlePayload.picture);
        } else {
          user = await this.createUser({
            email: googlePayload.email,
            name: googlePayload.name,
            picture: googlePayload.picture,
            googleId: googlePayload.sub,
          });
        }
      } else {
        user = await this.updateUserProfile(user.id, {
          name: googlePayload.name,
          picture: googlePayload.picture,
        });
      }

      const session = await this.createSession({ id: user.id, email: user.email });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          googleId: user.googleId,
        },
        session,
      };
    } catch (error) {
      console.error("Google auth error:", error);
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
        await this.db.delete(schema.sessions).where(eq(schema.sessions.id, existingSession.id));
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
      
      await this.db.delete(schema.sessions).where(eq(schema.sessions.id, existingSession.id));
      
      const newSession = await this.createSession({ id: user.id, email: user.email });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          googleId: user.googleId,
        },
        session: newSession,
      };
    } catch (error) {
      console.error("Refresh session error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refresh session",
      };
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; user?: AuthUser }> {
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
          googleId: user.googleId,
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
      googleId: user.googleId,
    };
  }

  private async verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
      );
      
      if (!response.ok) {
        console.error("Google token verification failed:", response.status);
        return null;
      }
      
      const payload = await response.json() as GoogleTokenPayload;
      
      if (!payload.email_verified) {
        console.error("Google email not verified");
        return null;
      }
      
      return payload;
    } catch (error) {
      console.error("Error verifying Google token:", error);
      return null;
    }
  }

  private async findUserByGoogleId(googleId: string) {
    const users = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.googleId, googleId))
      .limit(1);
    return users[0] || null;
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
    googleId?: string;
  }) {
    const result = await this.db
      .insert(schema.users)
      .values({
        email: data.email,
        name: data.name,
        picture: data.picture || null,
        googleId: data.googleId || null,
      })
      .returning();
    return (result as any[])[0];
  }

  private async updateUserGoogleId(userId: string, googleId: string, picture?: string) {
    const result = await this.db
      .update(schema.users)
      .set({ 
        googleId,
        picture: picture || undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  private async updateUserProfile(userId: string, data: { name?: string; picture?: string }) {
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

  private async createSession(user: { id: string; email: string }): Promise<AuthSession> {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: "refresh" },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.db.insert(schema.sessions).values({
      userId: user.id,
      refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }
}
