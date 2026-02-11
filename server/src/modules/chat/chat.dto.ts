import {
  IsString,
  IsOptional,
  ValidateNested,
  IsIn,
  IsArray,
  IsNumber,
} from "class-validator";
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

export class McpServerDto {
  @IsString()
  name!: string;

  @IsString()
  command!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  args?: string[];

  @IsOptional()
  env?: Record<string, string>;
}

export class AttachmentDto {
  @IsString()
  name!: string;

  @IsIn(["image", "file"])
  type!: "image" | "file";

  @IsString()
  mimeType!: string;

  @IsString()
  uri!: string;

  @IsOptional()
  @IsString()
  base64?: string;
}

export class SendMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

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

export class VoiceMessageDto {
  @IsString()
  audio!: string;

  @IsOptional()
  @IsString()
  userInstructions?: string;

  @IsOptional()
  @IsString()
  transcriptionModel?: string;

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

// ─── Zero-Storage DTOs ───────────────────────────────────────

export class HistoryMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  content!: string;
}

export class ClientRuleDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  condition!: string;

  @IsString()
  action!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;
}

export class ClientSkillDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  inputSchema?: string;

  @IsOptional()
  @IsString()
  outputSchema?: string;
}

export class MemoryFactDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}

/**
 * Stateless chat request: client sends everything the server needs.
 */
export class ChatRequestDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  userInstructions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientRuleDto)
  rules?: ClientRuleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientSkillDto)
  skills?: ClientSkillDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McpServerDto)
  mcpServers?: McpServerDto[];

  @IsOptional()
  @IsString()
  conversationSummary?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemoryFactDto)
  memoryFacts?: MemoryFactDto[];
}
