import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, ValidateNested } from "class-validator";

export class BootstrapLlmSettingsDto {
  @IsOptional()
  @IsIn(["replit", "openai", "groq", "ollama", "custom"])
  provider?: "replit" | "openai" | "groq" | "ollama" | "custom";

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class BootstrapErpSettingsDto {
  @IsOptional()
  @IsIn(["demo", "1c", "sap", "odoo", "custom"])
  provider?: "demo" | "1c" | "sap" | "odoo" | "custom";

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsIn(["rest", "odata", "graphql"])
  apiType?: "rest" | "odata" | "graphql";

  @IsOptional()
  @IsString()
  db?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class CredentialSessionBootstrapDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BootstrapLlmSettingsDto)
  llmSettings?: BootstrapLlmSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BootstrapErpSettingsDto)
  erpSettings?: BootstrapErpSettingsDto;

  @IsOptional()
  @IsString()
  dbUrl?: string;

  @IsOptional()
  @IsString()
  dbKey?: string;
}

export class CredentialSessionRevokeDto {
  @IsOptional()
  @IsString()
  sessionToken?: string;
}
