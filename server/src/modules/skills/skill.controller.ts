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
import { SkillService } from "./skill.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import type { InsertSkill } from "@shared/schema";

@Controller("skills")
@UseGuards(AuthGuard)
export class SkillController {
  constructor(private skillService: SkillService) {}

  @Get()
  async getSkills(@Req() req: AuthenticatedRequest) {
    return this.skillService.getSkills(req.user.id);
  }

  @Post()
  async createSkill(
    @Req() req: AuthenticatedRequest,
    @Body() body: InsertSkill,
  ) {
    return this.skillService.createSkill({
      ...body,
      userId: req.user.id,
    });
  }

  @Put(":id")
  async updateSkill(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Partial<InsertSkill>,
  ) {
    return this.skillService.updateSkill(id, req.user.id, body);
  }

  @Delete(":id")
  async deleteSkill(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.skillService.deleteSkill(id, req.user.id);
  }

  @Post(":id/execute")
  async executeSkill(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.skillService.executeSkill(id, req.user.id, body);
  }
}
