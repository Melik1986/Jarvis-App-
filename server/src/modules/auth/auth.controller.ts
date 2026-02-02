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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { RefreshRequest, AuthUser } from "./auth.types";
import { AuthGuard } from "./auth.guard";
import { SERVER_PUBLIC_KEY } from "../../config/jwk.config";

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

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

    if (!result.success || !result.session) {
      return res.redirect("/login?error=auth_failed");
    }

    try {
      JSON.parse(Buffer.from(state, "base64").toString());
    } catch {
      // State parsing failed, use default redirect
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "";

    const appRedirectUrl = new URL("/auth/success", baseUrl);
    appRedirectUrl.searchParams.set("accessToken", result.session.accessToken);
    appRedirectUrl.searchParams.set(
      "refreshToken",
      result.session.refreshToken,
    );
    appRedirectUrl.searchParams.set(
      "expiresIn",
      result.session.expiresIn.toString(),
    );
    if (result.user) {
      appRedirectUrl.searchParams.set("user", JSON.stringify(result.user));
    }

    res.redirect(appRedirectUrl.toString());
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
    const email = body.email || "dev@axon.local";
    const name = body.name || "Dev User";

    const result = await this.authService.authenticateFromSession({
      id: `dev-${Date.now()}`,
      email,
      name,
      picture: null,
    });

    return result;
  }
}
