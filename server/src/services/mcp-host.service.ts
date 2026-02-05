import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { AppLogger } from "../utils/logger";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  originalName: string;
  serverName: string;
}

@Injectable()
export class McpHostService implements OnModuleDestroy {
  private clients: Map<string, Client> = new Map();

  /**
   * Connect to an MCP server using stdio transport.
   */
  async connect(config: McpServerConfig): Promise<Client> {
    if (this.clients.has(config.name)) {
      return this.clients.get(config.name)!;
    }

    try {
      AppLogger.info(
        `Connecting to MCP server: ${config.name}`,
        undefined,
        "MCP",
      );

      // Only pass safe env vars to MCP servers - never pass secrets
      const SAFE_ENV_KEYS = [
        "PATH",
        "HOME",
        "USER",
        "SHELL",
        "LANG",
        "LC_ALL",
        "TERM",
        "NODE_ENV",
        "TZ",
        // Windows-specific
        "SYSTEMROOT",
        "COMSPEC",
        "PATHEXT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "PROGRAMFILES",
        "PROGRAMFILES(X86)",
      ];

      const env: Record<string, string> = {};
      for (const key of SAFE_ENV_KEYS) {
        // Server-side code: dynamic env access is intentional for safe key filtering
        // eslint-disable-next-line expo/no-dynamic-env-var
        const value = process.env[key];
        if (value !== undefined) {
          env[key] = value;
        }
      }
      // Merge user-provided env (explicit config takes precedence)
      if (config.env) {
        Object.assign(env, config.env);
      }

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env,
      });

      const client = new Client(
        {
          name: "Axon-Platform-Host",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        } as unknown as { capabilities: Record<string, unknown> },
      );

      await client.connect(transport);
      this.clients.set(config.name, client);

      AppLogger.info(
        `Successfully connected to MCP server: ${config.name}`,
        undefined,
        "MCP",
      );
      return client;
    } catch (error) {
      AppLogger.error(
        `Failed to connect to MCP server: ${config.name}`,
        error,
        "MCP",
      );
      throw error;
    }
  }

  /**
   * List all tools from all connected MCP servers.
   */
  async getAllTools(): Promise<McpToolDefinition[]> {
    const allTools: McpToolDefinition[] = [];
    for (const [name, client] of this.clients.entries()) {
      try {
        const result = await client.listTools();
        const toolsWithPrefix = (
          result.tools as {
            name: string;
            description?: string;
            inputSchema?: Record<string, unknown>;
          }[]
        ).map((tool) => ({
          ...tool,
          name: `${name}__${tool.name}`, // Prefix to avoid collisions
          originalName: tool.name,
          serverName: name,
        }));
        allTools.push(...toolsWithPrefix);
      } catch (error) {
        AppLogger.error(
          `Failed to list tools for MCP server: ${name}`,
          error,
          "MCP",
        );
      }
    }
    return allTools;
  }

  /**
   * Call a tool on a specific MCP server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    try {
      AppLogger.info(
        `Calling MCP tool: ${serverName}__${toolName}`,
        undefined,
        "MCP",
      );
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    } catch (error) {
      AppLogger.error(
        `Error calling MCP tool: ${serverName}__${toolName}`,
        error,
        "MCP",
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        AppLogger.info(
          `Closed connection to MCP server: ${name}`,
          undefined,
          "MCP",
        );
      } catch (error) {
        AppLogger.error(
          `Error closing MCP server connection: ${name}`,
          error,
          "MCP",
        );
      }
    }
    this.clients.clear();
  }
}
