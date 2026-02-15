import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { AppLogger } from "../utils/logger";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";

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
  private readonly dynamicConnectEnabled =
    process.env.MCP_DYNAMIC_CONNECT_ENABLED === "true";
  private readonly allowedCommands = this.parseList(
    process.env.MCP_ALLOWED_COMMANDS,
  );
  private readonly allowedEnvKeys = this.parseList(
    process.env.MCP_ALLOWED_ENV_KEYS,
  );

  isDynamicConnectEnabled(): boolean {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return this.dynamicConnectEnabled;
  }

  assertDynamicConnectEnabled(): void {
    if (!this.isDynamicConnectEnabled()) {
      throw new Error(
        "MCP dynamic connect is disabled by policy (set MCP_DYNAMIC_CONNECT_ENABLED=true in non-production only)",
      );
    }
  }

  validateDynamicServerConfig(config: McpServerConfig): McpServerConfig {
    this.assertDynamicConnectEnabled();
    const command = this.validateCommand(config.command);
    const env = this.filterAllowedEnv(config.env);

    return {
      ...config,
      command,
      env,
    };
  }

  /**
   * Connect to an MCP server using stdio transport.
   */
  async connect(config: McpServerConfig): Promise<Client> {
    if (this.clients.has(config.name)) {
      return this.clients.get(config.name)!;
    }

    try {
      const validatedConfig = this.validateDynamicServerConfig(config);

      AppLogger.info(
        `Connecting to MCP server: ${validatedConfig.name}`,
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
      if (validatedConfig.env) {
        Object.assign(env, validatedConfig.env);
      }

      const transport = new StdioClientTransport({
        command: validatedConfig.command,
        args: validatedConfig.args || [],
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
      this.clients.set(validatedConfig.name, client);

      AppLogger.info(
        `Successfully connected to MCP server: ${validatedConfig.name}`,
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
   * Get list of connected server names.
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a server is connected.
   */
  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  /**
   * Disconnect from a specific MCP server.
   */
  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      try {
        await client.close();
        this.clients.delete(serverName);
        AppLogger.info(
          `Disconnected from MCP server: ${serverName}`,
          undefined,
          "MCP",
        );
      } catch (error) {
        AppLogger.error(
          `Error disconnecting from MCP server: ${serverName}`,
          error,
          "MCP",
        );
        throw error;
      }
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

  private validateCommand(rawCommand: string): string {
    const command = (rawCommand || "").trim();
    if (!command) {
      throw new Error("MCP command is required");
    }

    if (this.allowedCommands.length === 0) {
      throw new Error(
        "MCP command allowlist is empty. Set MCP_ALLOWED_COMMANDS to enable dynamic MCP execution.",
      );
    }

    const normalized = command.toLowerCase();
    const basename = path.basename(command).toLowerCase();
    const isAllowed = this.allowedCommands.some((allowed) => {
      const allowedNorm = allowed.toLowerCase();
      const allowedBase = path.basename(allowed).toLowerCase();
      return (
        normalized === allowedNorm ||
        basename === allowedNorm ||
        normalized === allowedBase ||
        basename === allowedBase
      );
    });

    if (!isAllowed) {
      throw new Error(`MCP command is not allowed: ${command}`);
    }

    return command;
  }

  private filterAllowedEnv(
    source?: Record<string, string>,
  ): Record<string, string> | undefined {
    if (!source) return undefined;
    if (this.allowedEnvKeys.length === 0) {
      return {};
    }

    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
      if (this.allowedEnvKeys.includes(key) && typeof value === "string") {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  private parseList(rawValue?: string): string[] {
    if (!rawValue) return [];
    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
