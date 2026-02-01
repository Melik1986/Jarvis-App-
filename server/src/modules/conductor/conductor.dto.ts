import { IsString, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  LlmSettingsDto,
  ErpSettingsDto,
  RagSettingsDto,
} from "../chat/chat.dto";

export class ConductorParseDto {
  @ApiProperty({
    description: "Raw text from voice/Whisper (e.g. «три колы и один пирожок»)",
    example: "три колы и один пирожок",
  })
  @IsString()
  rawText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => LlmSettingsDto)
  llmSettings?: LlmSettingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ErpSettingsDto)
  erpSettings?: ErpSettingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => RagSettingsDto)
  ragSettings?: RagSettingsDto;
}
