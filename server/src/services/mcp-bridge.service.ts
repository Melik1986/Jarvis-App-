import { Injectable, Inject } from "@nestjs/common";
import { AppLogger } from "../utils/logger";
import {
  McpHostService,
  McpServerConfig,
  McpToolDefinition,
} from "./mcp-host.service";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

/**
 * MCP Tool call result type
 */
export interface McpToolResult {
  content: {
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }[];
  isError?: boolean;
}

/**
 * MCP Connection status
 */
export interface McpConnectionStatus {
  serverName: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

/**
 * MCP (Model Context Protocol) Bridge Service.
 * Provides universal ERP adapters through MCP servers.
 * Uses McpHostService for actual MCP SDK integration.
 */
@Injectable()
export class McpBridgeService {
  constructor(
    @Inject(McpHostService) private readonly mcpHost: McpHostService,
  ) {}

  /**
   * Connect to an MCP server.
   * @param serverConfig MCP server configuration
   * @returns MCP client instance
   */
  async connectToServer(serverConfig: McpServerConfig): Promise<Client> {
    AppLogger.info(
      `MCP Bridge: Connecting to ${serverConfig.name}`,
      undefined,
      "MCP",
    );

    try {
      const client = await this.mcpHost.connect(serverConfig);
      AppLogger.info(
        `MCP Bridge: Successfully connected to ${serverConfig.name}`,
        undefined,
        "MCP",
      );
      return client;
    } catch (error) {
      AppLogger.error(
        `MCP Bridge: Failed to connect to ${serverConfig.name}`,
        error,
        "MCP",
      );
      throw error;
    }
  }

  /**
   * Connect to multiple MCP servers.
   * Returns status for each server.
   */
  async connectMultiple(
    configs: McpServerConfig[],
  ): Promise<McpConnectionStatus[]> {
    const results: McpConnectionStatus[] = [];

    for (const config of configs) {
      try {
        await this.connectToServer(config);
        const tools = await this.listToolsForServer(config.name);
        results.push({
          serverName: config.name,
          connected: true,
          toolCount: tools.length,
        });
      } catch (error) {
        results.push({
          serverName: config.name,
          connected: false,
          toolCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * List available tools from all connected MCP servers.
   */
  async listAllTools(): Promise<McpToolDefinition[]> {
    return this.mcpHost.getAllTools();
  }

  /**
   * List tools from a specific MCP server.
   */
  async listToolsForServer(serverName: string): Promise<McpToolDefinition[]> {
    const allTools = await this.mcpHost.getAllTools();
    return allTools.filter((tool) => tool.serverName === serverName);
  }

  /**
   * Call a tool on an MCP server.
   * Handles the prefixed tool name format (serverName__toolName).
   */
  async callTool(
    prefixedToolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    // Parse prefixed name: serverName__toolName
    const separatorIndex = prefixedToolName.indexOf("__");
    if (separatorIndex === -1) {
      throw new Error(
        `Invalid tool name format: ${prefixedToolName}. Expected format: serverName__toolName`,
      );
    }

    const serverName = prefixedToolName.substring(0, separatorIndex);
    const toolName = prefixedToolName.substring(separatorIndex + 2);

    AppLogger.info(
      `MCP Bridge: Calling tool ${toolName} on server ${serverName}`,
      { args },
      "MCP",
    );

    try {
      const result = await this.mcpHost.callTool(serverName, toolName, args);
      return result as McpToolResult;
    } catch (error) {
      AppLogger.error(
        `MCP Bridge: Tool call failed - ${serverName}__${toolName}`,
        error,
        "MCP",
      );
      throw error;
    }
  }

  /**
   * Call a tool by server name and tool name separately.
   */
  async callToolDirect(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    return this.callTool(`${serverName}__${toolName}`, args);
  }

  /**
   * Extract text content from MCP tool result.
   */
  extractTextContent(result: McpToolResult): string {
    if (!result.content || !Array.isArray(result.content)) {
      return "";
    }

    return result.content
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n");
  }

  /**
   * Check if a tool result indicates an error.
   */
  isErrorResult(result: McpToolResult): boolean {
    return result.isError === true;
  }
}
