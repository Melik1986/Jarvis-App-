import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { AuthUser, AuthSession } from "./auth.types";
import { AppLogger } from "../../utils/logger";

interface ReplitOIDCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  scope?: string;
}

interface ReplitIDTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

interface TempAuthCode {
  session: AuthSession;
  user: AuthUser;
  expiresAt: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private jwtSecret!: string;
  private readonly accessTokenExpiry = "24h";
  private readonly refreshTokenExpiry = "30d";

  private readonly tempAuthCodes: Map<string, TempAuthCode> = new Map();
  private readonly TEMP_CODE_TTL_MS = 60 * 1000;

  private readonly REPLIT_AUTH_AUTHORIZE =
    "https://replit.com/auth/authorize";
  private readonly REPLIT_AUTH_TOKEN = "https://replit.com/auth/token";
  private readonly REPLIT_AUTH_USERINFO =
    "https://replit.com/auth/userinfo";

  constructor(@Inject(ConfigService) private configService: ConfigService) {}

  onModuleInit() {
    const secret = this.configService.get("SESSION_SECRET");
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET must be set in production environment.",
      );
    }
    this.jwtSecret = secret || "axon-dev-secret-not-for-production";

    setInterval(() => this.cleanupExpiredCodes(), 30 * 1000);
  }

  private getClientId(): string | undefined {
    return (
      this.configService.get("REPLIT_AUTH_CLIENT_ID") ||
      this.configService.get("REPL_ID")
    );
  }

  private getClientSecret(): string | undefined {
    return this.configService.get("REPLIT_AUTH_CLIENT_SECRET");
  }

  getCallbackUrl(): string {
    const devDomain = process.env.REPLIT_DEV_DOMAIN;
    const domains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
    const host = devDomain || domains;
    if (!host) {
      return "/api/auth/callback";
    }
    return `https://${host}:5000/api/auth/callback`;
  }

  getAuthUrl(callbackUrl: string, state: string): string {
    const clientId = this.getClientId();
    if (!clientId) {
      AppLogger.error("REPLIT_AUTH_CLIENT_ID or REPL_ID not configured");
      throw new Error("Auth not configured: missing client ID");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state: state,
    });

    return `${this.REPLIT_AUTH_AUTHORIZE}?${params.toString()}`;
  }

  async authenticateWithReplitCallback(
    code: string,
    state: string,
    callbackUrl: string,
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();

      if (!clientId) {
        return { success: false, error: "Auth not configured: missing client ID" };
      }

      const tokenBody: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: callbackUrl,
      };

      if (clientSecret) {
        tokenBody.client_secret = clientSecret;
      }

      AppLogger.info("Exchanging OIDC code for tokens...");

      const tokenResponse = await fetch(this.REPLIT_AUTH_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenBody).toString(),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        AppLogger.error(
          `OIDC token exchange failed (${tokenResponse.status}): ${errText}`,
        );
        return { success: false, error: "Token exchange failed" };
      }

      const tokenData =
        (await tokenResponse.json()) as ReplitOIDCTokenResponse;

      let userInfo: Partial<ReplitIDTokenPayload> = {};

      if (tokenData.id_token) {
        try {
          const decoded = jwt.decode(tokenData.id_token) as ReplitIDTokenPayload | null;
          if (decoded) {
            userInfo = decoded;
          }
        } catch (e) {
          AppLogger.warn("Failed to decode id_token, falling back to userinfo endpoint");
        }
      }

      if (!userInfo.sub && tokenData.access_token) {
        try {
          const userinfoRes = await fetch(this.REPLIT_AUTH_USERINFO, {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          });
          if (userinfoRes.ok) {
            const info = await userinfoRes.json();
            userInfo = { ...userInfo, ...info };
          }
        } catch (e) {
          AppLogger.warn("Failed to fetch userinfo:", e);
        }
      }

      if (!userInfo.sub) {
        return { success: false, error: "Could not retrieve user identity" };
      }

      const displayName =
        userInfo.name ||
        [userInfo.first_name, userInfo.last_name].filter(Boolean).join(" ") ||
        userInfo.email?.split("@")[0] ||
        `User-${userInfo.sub}`;

      const user: AuthUser = {
        id: `replit-${userInfo.sub}`,
        email: userInfo.email || `${userInfo.sub}@replit.user`,
        name: displayName,
        picture: userInfo.profile_image_url || null,
        replitId: userInfo.sub,
      };

      const session = this.createSession(user);

      AppLogger.info(`OIDC auth success for user: ${user.name} (${user.id})`);

      return { success: true, user, session };
    } catch (error) {
      AppLogger.error("Replit OIDC auth error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  generateTempAuthCode(user: AuthUser, session: AuthSession): string {
    const code = crypto.randomUUID();
    this.tempAuthCodes.set(code, {
      session,
      user,
      expiresAt: Date.now() + this.TEMP_CODE_TTL_MS,
    });
    return code;
  }

  exchangeTempAuthCode(
    code: string,
  ):
    | { success: true; user: AuthUser; session: AuthSession }
    | { success: false; error: string } {
    const stored = this.tempAuthCodes.get(code);

    if (!stored) {
      return { success: false, error: "Invalid or expired code" };
    }

    this.tempAuthCodes.delete(code);

    if (Date.now() > stored.expiresAt) {
      return { success: false, error: "Code expired" };
    }

    return {
      success: true,
      user: stored.user,
      session: stored.session,
    };
  }

  private cleanupExpiredCodes(): void {
    const now = Date.now();
    for (const [code, data] of this.tempAuthCodes.entries()) {
      if (now > data.expiresAt) {
        this.tempAuthCodes.delete(code);
      }
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

      return { success: true, user, session };
    } catch (error) {
      AppLogger.error("Session auth error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Authentication failed",
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

      return { success: true, user, session: newSession };
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
    return { success: true };
  }

  async getMe(userId: string): Promise<AuthUser | null> {
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
