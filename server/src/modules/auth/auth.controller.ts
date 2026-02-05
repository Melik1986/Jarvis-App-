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
    ).toString("base64");
    const callbackUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : ""}/api/auth/callback`;
    const authUrl = this.authService.getAuthUrl(callbackUrl, state);
    res.redirect(authUrl);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      return res.redirect("/login?error=no_code");
    }

    const result = await this.authService.authenticateWithReplitCallback(
      code,
      state,
    );

    if (!result.success || !result.session || !result.user) {
      return res.redirect("/login?error=auth_failed");
    }

    try {
      JSON.parse(Buffer.from(state, "base64").toString());
    } catch {
      // State parsing failed, use default redirect
    }

    // Generate temporary code for secure token exchange
    // This avoids passing tokens directly in URL (security best practice)
    const tempCode = this.authService.generateTempAuthCode(
      result.user,
      result.session,
    );

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "";

    // Redirect with temporary code only - tokens exchanged via POST
    const appRedirectUrl = new URL("/auth/success", baseUrl);
    appRedirectUrl.searchParams.set("code", tempCode);

    res.redirect(appRedirectUrl.toString());
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
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        user: { type: "object" },
        session: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            expiresIn: { type: "number" },
          },
        },
      },
    },
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
    // Stateless: req.user contains the user data from token
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
    description:
      "Returns the public key that clients should use to encrypt credentials before sending them to the server.",
  })
  @ApiResponse({
    status: 200,
    description: "Public key in PEM format",
    schema: {
      type: "object",
      properties: {
        publicKey: { type: "string" },
        algorithm: { type: "string", example: "ECDH-ES+HKDF-256" },
      },
    },
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
      throw new Error(
        "SESSION_SECRET must be set in production. " +
          "Generate a secure random string and set it as SESSION_SECRET env var.",
      );
    }
    // Dev-only fallback - never used in production due to check above
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
