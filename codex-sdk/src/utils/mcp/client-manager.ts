import type { AppConfig } from "../config.js";
import type { CoreMessage } from "ai";

import { log } from "../logger/log.js";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "ai/mcp-stdio";

// Type definitions
export type MCPServerType = "stdio" | "sse";

export interface MCPServerConfig {
  name: string;
  type: MCPServerType;
  enabled: boolean;
  command?: string;
  args?: Array<string>;
  url?: string;
}

// Type for MCP client with its name
interface NamedMCPClient {
  name: string;
  client: Awaited<ReturnType<typeof createMCPClient>> | null;
  connected: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MCPTools = any;

export class MCPClientManager {
  private clients: Array<NamedMCPClient> = [];
  private config: AppConfig;
  private allTools!: Record<string, MCPTools>;

  constructor(config: AppConfig) {
    this.config = config;
  }

  // Convert the new config structure to server configs with defaults
  private getEnabledServers(): Array<MCPServerConfig> {
    if (!this.config.mcp) {
      return [];
    }

    const servers: Array<MCPServerConfig> = [];

    // Convert the object structure to our internal format
    for (const [name, config] of Object.entries(this.config.mcp)) {
      // Skip if explicitly disabled
      if (config.enabled === false) {
        continue;
      }

      // Use defaults: type=stdio, enabled=true
      servers.push({
        name,
        type: config.type || "stdio",
        enabled: true,
        command: config.command,
        args: config.args,
        url: config.url,
      });
    }

    return servers;
  }

  // Initialize all enabled MCP clients
  async initialize(): Promise<void> {
    const servers = this.getEnabledServers();

    // Close any existing clients
    await this.closeAll();

    // Create new clients
    for (const server of servers) {
      try {
        const client = await this.createClient(server);
        this.clients.push({
          name: server.name,
          client,
          connected: true,
        });
        log(`Initialized MCP client: ${server.name}`);
      } catch (error) {
        log(`Failed to initialize MCP client ${server.name}: ${error}`);
        this.clients.push({
          name: server.name,
          client: null,
          connected: false,
        });
      }
    }
  }

  // Create a client based on server config
  private async createClient(server: MCPServerConfig) {
    if (server.type === "stdio") {
      if (!server.command || !server.args) {
        throw new Error(
          `Missing command or args for stdio MCP server ${server.name}`,
        );
      }

      const transport = new StdioMCPTransport({
        command: server.command,
        args: server.args,
      });

      return createMCPClient({
        transport,
      });
    } else if (server.type === "sse") {
      if (!server.url) {
        throw new Error(`Missing URL for SSE MCP server ${server.name}`);
      }

      return createMCPClient({
        transport: {
          type: "sse",
          url: server.url,
        },
      });
    } else {
      throw new Error(`Unsupported MCP server type: ${server.type}`);
    }
  }

  // Get all tools from all connected clients
  async getAllTools() {
    if (this.allTools) {
      return this.allTools;
    }

    const allTools: Record<string, MCPTools> = {};

    for (const client of this.clients) {
      if (client.connected && client.client) {
        try {
          const tools = await client.client.tools();
          Object.assign(allTools, tools);
          log(
            `Retrieved tools from MCP server: ${JSON.stringify(Object.keys(tools))}`,
          );
        } catch (error) {
          log(`Error getting tools: ${error}`);
        }
      }
    }

    this.allTools = allTools;
    return allTools;
  }

  // Check if a tool with the given name exists in any MCP client
  hasToolWithName(name: string): boolean {
    if (!this.allTools) {
      return false;
    }

    return name in this.allTools;
  }

  // Call a specific tool by name with the provided arguments
  async callTool({
    name,
    args,
    abortSignal,
    toolCallId,
    messages,
  }: {
    name: string;
    args: unknown;
    abortSignal?: AbortSignal;
    toolCallId: string;
    messages: Array<CoreMessage>;
  }): Promise<string> {
    // Find which client has this tool
    for (const client of this.clients) {
      if (!client.connected || !client.client) {
        continue;
      }

      try {
        const tools = await this.getAllTools();
        if (name in tools && tools[name]) {
          // Call the tool with the provided arguments
          return tools[name]!.execute(args, {
            toolCallId,
            messages,
            abortSignal,
          });
        }
      } catch (error) {
        log(`Error calling tool ${name} on client ${client.name}: ${error}`);
      }
    }

    throw new Error(`Tool ${name} not found in any connected MCP client`);
  }

  // Get status of all MCP servers
  getStatus() {
    // For the status, we need to include all servers from config
    const statuses: Array<{ name: string; connected: boolean }> = [];

    if (this.config.mcp) {
      // Create a map of connected clients for quick lookup
      const clientMap = new Map(
        this.clients.map((client) => [client.name, client]),
      );

      // Add all servers from config with their connection status
      for (const [name, config] of Object.entries(this.config.mcp)) {
        // Skip if explicitly disabled
        if (config.enabled === false) {
          continue;
        }

        const client = clientMap.get(name);
        statuses.push({
          name,
          connected: client ? client.connected : false,
        });
      }
    }

    return statuses;
  }

  // Close all clients
  async closeAll() {
    const closePromises = this.clients
      .filter(({ client, connected }) => connected && client)
      .map(({ client }) => client?.close());

    await Promise.all(closePromises);
    this.clients = [];
  }
}
