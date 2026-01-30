import { Controller, Post, Get, Body, Headers, UseGuards, Req, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { GoogleAuthRequest, RefreshRequest } from "./auth.types";
import { AuthGuard } from "./auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("google")
  async googleAuth(@Body() body: GoogleAuthRequest) {
    const result = await this.authService.authenticateWithGoogle(body.idToken);
    if (!result.success) {
      throw new UnauthorizedException(result.error);
    }
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
  async logout(@Body() body: RefreshRequest) {
    return this.authService.logout(body.refreshToken);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() req: any) {
    const user = await this.authService.getMe(req.user.id);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return { user };
  }

  @Get("validate")
  async validate(@Headers("authorization") authHeader: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { valid: false };
    }
    const token = authHeader.substring(7);
    return this.authService.validateToken(token);
  }
}
