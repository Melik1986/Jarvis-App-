import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { OtpSendRequest, OtpVerifyRequest, RefreshRequest } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("otp/send")
  async sendOtp(@Body() body: OtpSendRequest) {
    return this.authService.sendOtp(body.phone);
  }

  @Post("otp/verify")
  async verifyOtp(@Body() body: OtpVerifyRequest) {
    return this.authService.verifyOtp(body.phone, body.token);
  }

  @Post("refresh")
  async refresh(@Body() body: RefreshRequest) {
    return this.authService.refreshSession(body.refresh_token);
  }
}
