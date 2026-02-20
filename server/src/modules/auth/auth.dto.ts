import { Type } from "class-transformer";
import {
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class BootstrapLlmSettingsDto {
  @IsOptional()
  @IsIn(["replit", "openai", "google", "groq", "ollama", "custom"])
  provider?: "replit" | "openai" | "google" | "groq" | "ollama" | "custom";

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsEmpty({
    message:
      "llmSettings.apiKey must NOT be provided in body (use x-encrypted-config)",
  })
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
  @IsEmpty({
    message:
      "erpSettings.password must NOT be provided in body (use x-encrypted-config)",
  })
  @IsString()
  password?: string;

  @IsOptional()
  @IsEmpty({
    message:
      "erpSettings.apiKey must NOT be provided in body (use x-encrypted-config)",
  })
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
  @IsEmpty({
    message: "dbUrl must NOT be provided in body (use x-encrypted-config)",
  })
  @IsString()
  dbUrl?: string;

  @IsOptional()
  @IsEmpty({
    message: "dbKey must NOT be provided in body (use x-encrypted-config)",
  })
  @IsString()
  dbKey?: string;
}

export class CredentialSessionRevokeDto {
  @IsOptional()
  @IsString()
  sessionToken?: string;
}
