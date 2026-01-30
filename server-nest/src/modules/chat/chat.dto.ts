import { IsString, IsOptional, ValidateNested, IsIn } from "class-validator";
import { Type } from "class-transformer";
import { LlmSettings } from "../llm/llm.types";
import { ErpConfig } from "../erp/erp.types";
import { RagSettingsRequest } from "../rag/rag.types";

export class LlmSettingsDto implements LlmSettings {
  @IsIn(["replit", "openai", "groq", "ollama", "custom"])
  provider!: "replit" | "openai" | "groq" | "ollama" | "custom";

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  modelName?: string;
}

export class ErpSettingsDto implements Partial<ErpConfig> {
  @IsOptional()
  @IsIn(["demo", "1c", "sap", "odoo", "custom"])
  provider?: "demo" | "1c" | "sap" | "odoo" | "custom";

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsIn(["rest", "odata", "graphql"])
  apiType?: "rest" | "odata" | "graphql";
}

export class QdrantSettingsDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsString()
  collectionName!: string;
}

export class RagSettingsDto implements RagSettingsRequest {
  @IsIn(["qdrant", "none"])
  provider!: "qdrant" | "none";

  @IsOptional()
  @ValidateNested()
  @Type(() => QdrantSettingsDto)
  qdrant?: QdrantSettingsDto;
}

export class SendMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LlmSettingsDto)
  llmSettings?: LlmSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ErpSettingsDto)
  erpSettings?: ErpSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RagSettingsDto)
  ragSettings?: RagSettingsDto;
}

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  title?: string;
}
