import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { RulebookService } from "./rulebook.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import type { InsertRule } from "@shared/schema";

@Controller("rules")
@UseGuards(AuthGuard)
export class RulebookController {
  constructor(private rulebookService: RulebookService) {}

  @Get()
  async getRules(@Req() req: AuthenticatedRequest) {
    return this.rulebookService.getRules(req.user.id);
  }

  @Post()
  async createRule(@Req() req: AuthenticatedRequest, @Body() body: InsertRule) {
    return this.rulebookService.createRule({
      ...body,
      userId: req.user.id,
    });
  }

  @Put(":id")
  async updateRule(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Partial<InsertRule>,
  ) {
    return this.rulebookService.updateRule(id, req.user.id, body);
  }

  @Delete(":id")
  async deleteRule(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.rulebookService.deleteRule(id, req.user.id);
  }
}
