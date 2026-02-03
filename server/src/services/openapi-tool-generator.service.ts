import { Injectable } from "@nestjs/common";
import SwaggerParser from "@apidevtools/swagger-parser";
import { dynamicTool, jsonSchema, type Tool, type JSONSchema7 } from "ai";
import { AppLogger } from "../utils/logger";

type JSONSchema7TypeName =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

@Injectable()
export class OpenApiToolGeneratorService {
  /**
   * Parse OpenAPI spec and generate tools for AI SDK.
   */
  async generateToolsFromSpec(
    specUrl: string,
    baseUrl?: string,
  ): Promise<Record<string, Tool<unknown, unknown>>> {
    try {
      AppLogger.info(`Parsing OpenAPI spec: ${specUrl}`, undefined, "OpenAPI");
      const api = (await SwaggerParser.dereference(specUrl)) as {
        servers?: { url: string }[];
        paths?: Record<string, Record<string, OpenApiOperation>>;
      };
      const tools: Record<string, Tool<unknown, unknown>> = {};

      const serverUrl = baseUrl || (api.servers && api.servers[0]?.url) || "";

      for (const [path, methods] of Object.entries(api.paths || {})) {
        for (const [method, operation] of Object.entries(methods || {})) {
          if (typeof operation !== "object" || !operation) continue;

          const op = operation as OpenApiOperation;
          const toolName = this.generateToolName(method, path, op.operationId);

          tools[toolName] = dynamicTool({
            description:
              op.description ||
              op.summary ||
              `Execute ${method.toUpperCase()} ${path}`,
            inputSchema: this.generateInputSchema(op),
            execute: async (args: unknown) => {
              return this.executeRequest(
                serverUrl,
                path,
                method,
                args as Record<string, unknown>,
                op,
              );
            },
          });
        }
      }

      AppLogger.info(
        `Generated ${Object.keys(tools).length} tools from spec: ${specUrl}`,
        undefined,
        "OpenAPI",
      );
      return tools;
    } catch (error) {
      AppLogger.error(
        `Failed to generate tools from OpenAPI spec: ${specUrl}`,
        error,
        "OpenAPI",
      );
      return {};
    }
  }

  private generateToolName(
    method: string,
    path: string,
    operationId?: string,
  ): string {
    if (operationId) return operationId.replace(/[^a-zA-Z0-9_]/g, "_");

    const cleanPath = path
      .replace(/\{([^}]+)\}/g, "$1")
      .replace(/[^a-zA-Z0-9]/g, "_");
    return `${method.toLowerCase()}${cleanPath}`;
  }

  private generateInputSchema(operation: OpenApiOperation) {
    const properties: Record<string, JSONSchema7> = {};
    const required: string[] = [];

    // Path, Query, Header parameters
    for (const param of operation.parameters || []) {
      properties[param.name] = {
        type: (param.schema?.type as JSONSchema7TypeName) || "string",
        description: param.description || "",
      };
      if (param.required) required.push(param.name);
    }

    // Request Body
    if (operation.requestBody) {
      const content = operation.requestBody.content?.["application/json"];
      if (content?.schema) {
        if (content.schema.properties) {
          Object.assign(properties, content.schema.properties);
          if (content.schema.required)
            required.push(...content.schema.required);
        }
      }
    }

    return jsonSchema({
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    });
  }

  private async executeRequest(
    baseUrl: string,
    path: string,
    method: string,
    args: Record<string, unknown>,
    operation: OpenApiOperation,
  ) {
    let url = `${baseUrl}${path}`;
    const queryParams = new URLSearchParams();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let body: Record<string, unknown> | null = null;

    const parameters = operation.parameters || [];
    for (const param of parameters) {
      if (param.in === "path") {
        url = url.replace(`{${param.name}}`, String(args[param.name] ?? ""));
      } else if (param.in === "query" && args[param.name] !== undefined) {
        queryParams.append(param.name, String(args[param.name]));
      } else if (param.in === "header" && args[param.name] !== undefined) {
        headers[param.name] = String(args[param.name]);
      }
    }

    if (operation.requestBody) {
      const paramNames = parameters.map((p) => p.name);
      body = {};
      for (const [key, value] of Object.entries(args)) {
        if (!paramNames.includes(key)) body[key] = value;
      }
    }

    const fullUrl = queryParams.toString()
      ? `${url}?${queryParams.toString()}`
      : url;

    AppLogger.info(
      `Executing OpenAPI request: ${method.toUpperCase()} ${fullUrl}`,
      undefined,
      "OpenAPI",
    );

    const response = await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers,
      body:
        body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Request failed (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}

interface OpenApiOperation {
  description?: string;
  summary?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: {
          properties?: Record<string, unknown>;
          required?: string[];
        };
      };
    };
  };
}

interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | string;
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
  };
}
