import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { RefreshRequest, AuthUser, AuthSession } from "./auth.types";
import { AuthGuard } from "./auth.guard";
import { SERVER_PUBLIC_KEY } from "../../config/jwk.config";
import * as jwt from "jsonwebtoken";
import { AppLogger } from "../../utils/logger";

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get("login")
  async login(@Query("redirect") redirect: string, @Res() res: Response) {
    const state = Buffer.from(
      JSON.stringify({ redirect: redirect || "/" }),
    ).toString("base64url");
    const callbackUrl = this.authService.getCallbackUrl();

    try {
      const authUrl = this.authService.getAuthUrl(callbackUrl, state);
      AppLogger.info(
        `Auth: Redirecting to Replit OIDC: ${authUrl.substring(0, 80)}...`,
      );
      res.redirect(authUrl);
    } catch (error) {
      AppLogger.error("Auth login error:", error);
      const errorRedirect = redirect || "/";
      if (
        errorRedirect.startsWith("exp://") ||
        errorRedirect.startsWith("axon://")
      ) {
        const sep = errorRedirect.includes("?") ? "&" : "?";
        return res.redirect(`${errorRedirect}${sep}error=auth_not_configured`);
      }
      return res.status(500).json({
        error: "Auth not configured",
        message:
          "Replit Auth credentials are not set. Enable Replit Auth in the workspace Auth pane.",
      });
    }
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      AppLogger.error(`OIDC callback error: ${error}`);
      return res.redirect("/login?error=auth_denied");
    }

    if (!code) {
      return res.redirect("/login?error=no_code");
    }

    const callbackUrl = this.authService.getCallbackUrl();

    const result = await this.authService.authenticateWithReplitCallback(
      code,
      state,
      callbackUrl,
    );

    if (!result.success || !result.session || !result.user) {
      AppLogger.error(`Auth callback failed: ${result.error}`);
      return res.redirect("/login?error=auth_failed");
    }

    let clientRedirect: string | null = null;
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
      if (stateData.redirect) {
        clientRedirect = stateData.redirect;
      }
    } catch {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString());
        if (stateData.redirect) {
          clientRedirect = stateData.redirect;
        }
      } catch {
        // State parsing failed
      }
    }

    const tempCode = this.authService.generateTempAuthCode(
      result.user,
      result.session,
    );

    if (
      clientRedirect &&
      (clientRedirect.startsWith("exp://") ||
        clientRedirect.startsWith("axon://"))
    ) {
      const separator = clientRedirect.includes("?") ? "&" : "?";
      return res.redirect(`${clientRedirect}${separator}code=${tempCode}`);
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "";

    const appRedirectUrl = new URL(clientRedirect || "/auth/success", baseUrl);
    appRedirectUrl.searchParams.set("code", tempCode);

    res.redirect(appRedirectUrl.toString());
  }

  @Post("register")
  @ApiOperation({
    summary: "Register a new user with email and password",
  })
  @ApiResponse({ status: 201, description: "User registered successfully" })
  @ApiResponse({ status: 400, description: "Invalid input or email taken" })
  async register(
    @Body() body: { email: string; password: string; name?: string },
  ) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException("Email and password are required");
    }

    if (body.password.length < 6) {
      throw new UnauthorizedException("Password must be at least 6 characters");
    }

    const result = await this.authService.register(
      body.email,
      body.password,
      body.name,
    );

    if (!result.success) {
      throw new UnauthorizedException(result.error);
    }

    return result;
  }

  @Post("login")
  @ApiOperation({
    summary: "Login with email and password",
  })
  @ApiResponse({ status: 200, description: "Login successful" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async loginWithPassword(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException("Email and password are required");
    }

    const result = await this.authService.loginWithPassword(
      body.email,
      body.password,
    );

    if (!result.success) {
      throw new UnauthorizedException(result.error);
    }

    return result;
  }

  @Post("exchange")
  @ApiOperation({
    summary: "Exchange temporary auth code for tokens",
    description:
      "Exchange a one-time temporary code (from OAuth callback) for access and refresh tokens. " +
      "Code expires in 60 seconds and can only be used once.",
  })
  @ApiResponse({
    status: 200,
    description: "Tokens returned successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid or expired code" })
  exchangeCode(@Body() body: { code: string }) {
    if (!body.code) {
      throw new UnauthorizedException("Code is required");
    }

    const result = this.authService.exchangeTempAuthCode(body.code);
    if (!result.success) {
      throw new UnauthorizedException(result.error);
    }

    return result;
  }

  @Get("session")
  async getSession(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (!user) {
      return { authenticated: false };
    }

    const result = await this.authService.authenticateFromSession(user);
    return result;
  }

  @Post("refresh")
  async refresh(@Body() body: RefreshRequest) {
    const result = await this.authService.refreshSession(body.refreshToken);
    if (!result.success) {
      throw new UnauthorizedException(result.error);
    }
    return result;
  }

  @Post("logout")
  async logout(@Body() body: RefreshRequest, @Req() req: AuthenticatedRequest) {
    if (body.refreshToken) {
      await this.authService.logout(body.refreshToken);
    }
    req.logout?.(() => {});
    return { success: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException("User not found");
    }
    return { user: req.user };
  }

  @Get("validate")
  async validate(@Headers("authorization") authHeader: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { valid: false };
    }
    const token = authHeader.substring(7);
    return this.authService.validateToken(token);
  }

  @Get("status")
  async status(@Req() req: AuthenticatedRequest) {
    const isAuthenticated = !!req.user;
    return {
      authenticated: isAuthenticated,
      user: isAuthenticated ? req.user : null,
    };
  }

  @Get("public-key")
  @ApiOperation({
    summary: "Get server public key for JWE encryption",
  })
  getPublicKey() {
    return {
      publicKey: SERVER_PUBLIC_KEY,
      algorithm: "ECDH-ES+HKDF-256",
    };
  }

  @Post("dev-login")
  async devLogin(@Body() body: { email?: string; name?: string }) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Dev login is disabled in production");
    }

    const email = body.email || "dev@axon.local";
    const name = body.name || "Dev User";

    const user: AuthUser = {
      id: `dev-${Date.now()}`,
      email,
      name,
      picture: null,
      replitId: null,
    };

    if (
      !this.authService ||
      typeof this.authService.authenticateFromSession !== "function"
    ) {
      return this.createDevSession(user);
    }

    const result = await this.authService.authenticateFromSession(user);

    return result;
  }

  private createDevSession(user: AuthUser): {
    success: boolean;
    user: AuthUser;
    session: AuthSession;
  } {
    const jwtSecret = process.env.SESSION_SECRET;
    if (!jwtSecret && process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production.");
    }
    const secret = jwtSecret || "axon-dev-secret-not-for-production";

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        replitId: user.replitId,
      },
      secret,
      { expiresIn: "24h" },
    );
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        replitId: user.replitId,
        type: "refresh",
      },
      secret,
      { expiresIn: "30d" },
    );

    return {
      success: true,
      user,
      session: {
        accessToken,
        refreshToken,
        expiresIn: 24 * 60 * 60,
      },
    };
  }
}
