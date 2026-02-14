import { Body, Controller, Post, UseGuards, Inject, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { ErpService } from "./erp.service";
import { ErpSettingsDto } from "./erp.dto";
import { RequestSignatureGuard } from "../../guards/request-signature.guard";
import { AuthenticatedRequest } from "../auth/auth.types";

@ApiTags("erp")
@Controller("erp")
@UseGuards(AuthGuard)
export class ErpController {
  constructor(@Inject(ErpService) private readonly erpService: ErpService) {}

  @Post("test")
  @UseGuards(AuthGuard, RequestSignatureGuard)
  async testConnection(
    @Body() body: { erpSettings: ErpSettingsDto },
    @Req() req: AuthenticatedRequest,
  ) {
    const { erpSettings } = body || {};
    const credentials = req.ephemeralCredentials;
    const customConfig = {
      ...(erpSettings || {}),
      ...(credentials?.erpProvider && {
        provider: credentials.erpProvider as
          | "demo"
          | "1c"
          | "sap"
          | "odoo"
          | "custom",
      }),
      ...(credentials?.erpBaseUrl && { baseUrl: credentials.erpBaseUrl }),
      ...(credentials?.erpApiType && {
        apiType: credentials.erpApiType as "rest" | "odata" | "graphql",
      }),
      ...(credentials?.erpDb && { db: credentials.erpDb }),
      ...(credentials?.erpUsername && { username: credentials.erpUsername }),
      ...(credentials?.erpPassword && { password: credentials.erpPassword }),
      ...(credentials?.erpApiKey && { apiKey: credentials.erpApiKey }),
    } as ErpSettingsDto;
    const result = await this.erpService.testConnection(customConfig);
    return result;
  }
}
