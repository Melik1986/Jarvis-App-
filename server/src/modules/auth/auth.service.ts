import { Injectable, Inject, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { AuthUser, AuthSession } from "./auth.types";
import { AppLogger } from "../../utils/logger";
import { DATABASE_CONNECTION, Database } from "../../db/db.module";
import { users } from "../../../../shared/schema";
import { AUTH_CONFIG } from "../../config/auth.config";

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
  private readonly accessTokenExpiry: string = AUTH_CONFIG.ACCESS_TOKEN_EXPIRY;
  private readonly refreshTokenExpiry: string =
    AUTH_CONFIG.REFRESH_TOKEN_EXPIRY;

  private readonly tempAuthCodes: Map<string, TempAuthCode> = new Map();
  private readonly pkceVerifiers: Map<string, string> = new Map();

  private readonly REPLIT_AUTH_AUTHORIZE = "https://replit.com/oidc/auth";
  private readonly REPLIT_AUTH_TOKEN = "https://replit.com/oidc/token";
  private readonly REPLIT_AUTH_USERINFO = "https://replit.com/oidc/me";
  private readonly REPLIT_OIDC_ISSUER = "https://replit.com/oidc";
  private readonly replitJWKS = createRemoteJWKSet(
    new URL("https://replit.com/oidc/jwks"),
  );

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Optional()
    @Inject(DATABASE_CONNECTION)
    private db: Database,
  ) {}

  onModuleInit() {
    const secret = this.configService.get("SESSION_SECRET");
    const allowInsecureDevSecrets =
      process.env.ALLOW_INSECURE_DEV_SECRETS === "true";
    if (
      !secret &&
      (process.env.NODE_ENV === "production" || !allowInsecureDevSecrets)
    ) {
      throw new Error(
        "SESSION_SECRET must be set (or ALLOW_INSECURE_DEV_SECRETS=true in development).",
      );
    }
    this.jwtSecret = secret || crypto.randomBytes(48).toString("hex");
    if (!secret) {
      AppLogger.warn(
        "SESSION_SECRET is not set. Generated ephemeral development JWT secret.",
      );
    }

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
    const deployedDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
    const host = deployedDomain || devDomain;
    if (!host) {
      return "/api/auth/callback";
    }
    return `https://${host}:5000/api/auth/callback`;
  }

  private generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    return { verifier, challenge };
  }

  getCodeVerifier(state: string): string | undefined {
    const verifier = this.pkceVerifiers.get(state);
    if (verifier) {
      this.pkceVerifiers.delete(state);
    }
    return verifier;
  }

  getAuthUrl(callbackUrl: string, state: string): string {
    const clientId = this.getClientId();
    if (!clientId) {
      AppLogger.error("REPLIT_AUTH_CLIENT_ID or REPL_ID not configured");
      throw new Error("Auth not configured: missing client ID");
    }

    const pkce = this.generatePKCE();
    this.pkceVerifiers.set(state, pkce.verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state: state,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
    });

    return `${this.REPLIT_AUTH_AUTHORIZE}?${params.toString()}`;
  }

  async authenticateWithReplitCallback(
    code: string,
    state: string,
    callbackUrl: string,
    codeVerifier?: string,
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
        return {
          success: false,
          error: "Auth not configured: missing client ID",
        };
      }

      const tokenBody: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: callbackUrl,
      };

      if (codeVerifier) {
        tokenBody.code_verifier = codeVerifier;
      }

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

      const tokenData = (await tokenResponse.json()) as ReplitOIDCTokenResponse;

      let userInfo: Partial<ReplitIDTokenPayload> = {};

      // Verify id_token signature + issuer + audience via Replit JWKS
      if (tokenData.id_token) {
        try {
          const { payload } = await jwtVerify(
            tokenData.id_token,
            this.replitJWKS,
            {
              issuer: this.REPLIT_OIDC_ISSUER,
              audience: clientId,
            },
          );
          userInfo = payload as unknown as Partial<ReplitIDTokenPayload>;
          AppLogger.info("id_token signature verified via JWKS");
        } catch (verifyErr) {
          AppLogger.warn(
            "id_token JWKS verification failed, falling back to userinfo endpoint",
            verifyErr,
          );
        }
      }

      // Fallback: authenticated userinfo endpoint (access_token from code exchange)
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
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  generateTempAuthCode(user: AuthUser, session: AuthSession): string {
    const code = crypto.randomUUID();
    this.tempAuthCodes.set(code, {
      session,
      user,
      expiresAt: Date.now() + AUTH_CONFIG.TEMP_CODE_TTL_MS,
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

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    if (!this.db) {
      return { success: false, error: "Database not available" };
    }

    try {
      const existing = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (existing.length > 0) {
        return { success: false, error: "Email already registered" };
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const rows = await this.db
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          name: name || email.split("@")[0],
          passwordHash,
        })
        .returning();

      const newUser = rows[0];
      if (!newUser) throw new Error("Failed to create user");

      const user: AuthUser = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        picture: newUser.picture ?? undefined,
        replitId: newUser.replitId ?? undefined,
      };

      const session = this.createSession(user);

      AppLogger.info(`User registered: ${user.email} (${user.id})`);

      return { success: true, user, session };
    } catch (error) {
      AppLogger.error("Registration error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Registration failed",
      };
    }
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    if (!this.db) {
      return { success: false, error: "Database not available" };
    }

    try {
      const [found] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!found || !found.passwordHash) {
        return { success: false, error: "Invalid email or password" };
      }

      const valid = await bcrypt.compare(password, found.passwordHash);
      if (!valid) {
        return { success: false, error: "Invalid email or password" };
      }

      const user: AuthUser = {
        id: found.id,
        email: found.email,
        name: found.name,
        picture: found.picture,
        replitId: found.replitId,
      };

      const session = this.createSession(user);

      AppLogger.info(`User logged in: ${user.email} (${user.id})`);

      return { success: true, user, session };
    } catch (error) {
      AppLogger.error("Login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
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

      return { success: true, user, session };
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
    try {
      const payload = jwt.verify(
        refreshToken,
        this.jwtSecret,
      ) as jwt.JwtPayload;
      const sub = payload?.sub as string | undefined;
      if (sub) {
        AppLogger.info("User logout", { sub });
      }
    } catch {}
    return { success: true };
  }

  async getMe(userId: string): Promise<AuthUser | null> {
    if (!this.db) return null;
    try {
      const [row] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        picture: row.picture ?? undefined,
        replitId: row.replitId ?? undefined,
      };
    } catch (e) {
      AppLogger.error("getMe error:", e);
      return null;
    }
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
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { ...payload, type: "refresh" },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry } as jwt.SignOptions,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60,
    };
  }
}
