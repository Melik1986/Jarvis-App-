import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { RequestSignatureGuard } from "../../guards/request-signature.guard";
import {
  McpHostService,
  McpServerConfig,
} from "../../services/mcp-host.service";
import {
  McpBridgeService,
  McpConnectionStatus,
} from "../../services/mcp-bridge.service";

interface McpServerStatus {
  name: string;
  command: string;
  args: string[];
  status: "connected" | "disconnected" | "error";
  toolCount?: number;
  error?: string;
}

interface ConnectServerDto {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

@ApiTags("mcp")
@Controller("mcp")
@UseGuards(AuthGuard)
export class McpController {
  constructor(
    @Inject(McpHostService) private readonly mcpHost: McpHostService,
    @Inject(McpBridgeService) private readonly mcpBridge: McpBridgeService,
  ) {}

  /**
   * Get list of all MCP servers (connected and configured).
   */
  @Get("servers")
  @ApiOperation({ summary: "List MCP servers" })
  @ApiResponse({ status: 200, description: "Returns list of MCP servers" })
  async listServers(): Promise<McpServerStatus[]> {
    const connectedServers = this.mcpHost.getConnectedServers();
    const allTools = await this.mcpHost.getAllTools();

    // Count tools per server
    const toolCountByServer = new Map<string, number>();
    for (const tool of allTools) {
      const count = toolCountByServer.get(tool.serverName) || 0;
      toolCountByServer.set(tool.serverName, count + 1);
    }

    return connectedServers.map((name) => ({
      name,
      command: "", // We don't store original command after connection
      args: [],
      status: "connected" as const,
      toolCount: toolCountByServer.get(name) || 0,
    }));
  }

  /**
   * Connect to an MCP server.
   */
  @Post("servers")
  @UseGuards(AuthGuard, RateLimitGuard, RequestSignatureGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Connect to an MCP server" })
  @ApiResponse({ status: 201, description: "Server connected successfully" })
  @ApiResponse({ status: 400, description: "Connection failed" })
  async connectServer(
    @Body() dto: ConnectServerDto,
  ): Promise<McpConnectionStatus> {
    if (!this.mcpHost.isDynamicConnectEnabled()) {
      throw new ForbiddenException(
        "Dynamic MCP connect is disabled in this environment",
      );
    }

    let config: McpServerConfig;
    try {
      config = this.mcpHost.validateDynamicServerConfig({
        name: dto.name,
        command: dto.command,
        args: dto.args,
        env: dto.env,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid MCP server config",
      );
    }

    try {
      await this.mcpBridge.connectToServer(config);
      const tools = await this.mcpBridge.listToolsForServer(dto.name);
      return {
        serverName: dto.name,
        connected: true,
        toolCount: tools.length,
      };
    } catch (error) {
      return {
        serverName: dto.name,
        connected: false,
        toolCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Disconnect from an MCP server.
   */
  @Delete("servers/:name")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disconnect from an MCP server" })
  @ApiResponse({ status: 204, description: "Server disconnected" })
  @ApiResponse({ status: 404, description: "Server not found" })
  async disconnectServer(@Param("name") name: string): Promise<void> {
    await this.mcpHost.disconnect(name);
  }

  /**
   * List all available tools across all connected servers.
   */
  @Get("tools")
  @ApiOperation({ summary: "List all MCP tools" })
  @ApiResponse({ status: 200, description: "Returns list of tools" })
  async listTools() {
    return this.mcpBridge.listAllTools();
  }

  /**
   * List tools for a specific server.
   */
  @Get("servers/:name/tools")
  @ApiOperation({ summary: "List tools for a specific server" })
  @ApiResponse({ status: 200, description: "Returns list of tools for server" })
  async listServerTools(@Param("name") name: string) {
    return this.mcpBridge.listToolsForServer(name);
  }
}
