/**
 * Agent Manager
 * Manages lifecycle of multiple Claude Code agents
 */

import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { Agent } from "./agent.ts";
import type {
  AgentConfig,
  CreateAgentOptions,
  ManagerConfig,
  ManagerInfo,
  MCPServerConfig,
  StreamResponse,
} from "./types.ts";

/**
 * Manager class for creating and managing multiple agents
 */
export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private baseDirectory: string;
  private verified = false;
  private settingsTemplatePath: string;
  private defaultMcpServers: MCPServerConfig[];

  constructor(config?: ManagerConfig | string) {
    // Support both old string API and new config object
    if (typeof config === "string" || config === undefined) {
      this.baseDirectory = config || "./agent-workspaces";
      this.defaultMcpServers = [];
      this.settingsTemplatePath = join(
        new URL(".", import.meta.url).pathname,
        "settings-template.json",
      );
    } else {
      this.baseDirectory = config.baseDirectory || "./agent-workspaces";
      this.defaultMcpServers = config.defaultMcpServers || [];
      this.settingsTemplatePath = config.settingsTemplatePath || join(
        new URL(".", import.meta.url).pathname,
        "settings-template.json",
      );
    }
  }

  /**
   * Initialize the manager and verify Claude Code SDK is available
   */
  async initialize(): Promise<void> {
    // Ensure base directory exists
    await ensureDir(this.baseDirectory);

    // Verify Claude SDK installation
    this.verified = await Agent.verifyClaudeInstallation();
    if (!this.verified) {
      throw new Error(
        "Claude Code SDK not found. Please install it with: npm install @anthropic-ai/claude-code",
      );
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(options: CreateAgentOptions = {}): Promise<Agent> {
    if (!this.verified) {
      await this.initialize();
    }

    const agentConfig: AgentConfig = {
      name: options.name,
      description: options.description,
      workingDirectory: options.workingDirectory ||
        join(this.baseDirectory, `agent-${Date.now()}`),
      permissionMode: options.permissionMode,
      allowedTools: options.allowedTools,
      mcpServers: options.mcpServers,
      settingsTemplate: options.settingsTemplate,
    };

    // Ensure the working directory exists
    await ensureDir(agentConfig.workingDirectory);

    // Combine default MCP servers with agent-specific ones
    const allMcpServers = this.mergeMcpServers(
      this.defaultMcpServers,
      options.mcpServers || [],
    );

    // Create .mcp.json in project root with MCP servers configuration
    // Also create .claude/settings.local.json for auto-approval
    if (allMcpServers.length > 0) {
      await this.createMcpConfigFile(
        agentConfig.workingDirectory,
        allMcpServers,
      );
      await this.createClaudeSettings(
        agentConfig.workingDirectory,
      );
    }

    const agent = new Agent(agentConfig);
    this.agents.set(agent.id, agent);

    return agent;
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Send command to agent
   */
  async *sendCommand(
    agentId: string,
    prompt: string,
    sessionId?: string,
  ): AsyncGenerator<StreamResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }

    yield* agent.execute(prompt, sessionId);
  }

  /**
   * Stop an agent's current execution
   */
  stopAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    agent.abort();
    return true;
  }

  /**
   * Remove an agent and optionally clean up its directory
   */
  async removeAgent(id: string, keepDirectory = false): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    agent.abort();
    this.agents.delete(id);

    // Optionally clean up the working directory
    if (!keepDirectory) {
      try {
        await Deno.remove(agent.workingDirectory, { recursive: true });
      } catch (error) {
        console.error(`Failed to remove agent directory: ${error}`);
      }
    }

    return true;
  }

  /**
   * Remove all agents
   */
  async removeAllAgents(keepDirectories = false): Promise<number> {
    const agentIds = Array.from(this.agents.keys());
    let removed = 0;

    for (const id of agentIds) {
      if (await this.removeAgent(id, keepDirectories)) {
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clean up manager and all agents
   */
  async cleanup(): Promise<void> {
    // Stop all agents
    for (const agent of this.agents.values()) {
      agent.abort();
    }

    // Clear the agents map
    this.agents.clear();

    // Optionally clean up the base directory
    try {
      await Deno.remove(this.baseDirectory, { recursive: true });
    } catch (error) {
      console.error(`Failed to remove base directory: ${error}`);
    }
  }

  /**
   * Create .mcp.json in project root with MCP servers
   */
  private async createMcpConfigFile(
    workingDirectory: string,
    mcpServers: MCPServerConfig[],
  ): Promise<void> {
    const mcpConfig: any = {
      mcpServers: {},
    };

    // Add MCP servers to config
    for (const server of mcpServers) {
      if (server.url) {
        // HTTP/SSE servers - use "type": "http" format
        mcpConfig.mcpServers[server.name] = {
          type: "http",
          url: server.url,
          transport: server.transport || "http",
        };
      } else if (server.command) {
        // stdio servers (local commands)
        mcpConfig.mcpServers[server.name] = {
          type: "stdio",
          command: server.command,
          args: server.args || [],
          env: server.env || {},
        };
      }
    }

    // Write .mcp.json to agent's working directory (project root)
    await Deno.writeTextFile(
      join(workingDirectory, ".mcp.json"),
      JSON.stringify(mcpConfig, null, 2),
    );
  }

  /**
   * Create .claude/settings.local.json for auto-approval of MCP servers
   */
  private async createClaudeSettings(
    workingDirectory: string,
  ): Promise<void> {
    const claudeDir = join(workingDirectory, ".claude");
    await ensureDir(claudeDir);
    
    const settings = {
      "enableAllProjectMcpServers": true,
      "theme": "light"
    };
    
    await Deno.writeTextFile(
      join(claudeDir, "settings.local.json"),
      JSON.stringify(settings, null, 2),
    );
  }

  /**
   * Merge default MCP servers with agent-specific ones
   * Agent-specific servers override defaults with the same name
   */
  private mergeMcpServers(
    defaultServers: MCPServerConfig[],
    agentServers: MCPServerConfig[],
  ): MCPServerConfig[] {
    const serverMap = new Map<string, MCPServerConfig>();

    // Add default servers
    for (const server of defaultServers) {
      serverMap.set(server.name, server);
    }

    // Add or override with agent-specific servers
    for (const server of agentServers) {
      serverMap.set(server.name, server);
    }

    return Array.from(serverMap.values());
  }

  /**
   * Get manager information
   */
  getInfo(): ManagerInfo {
    return {
      baseDirectory: this.baseDirectory,
      agentCount: this.agents.size,
      agents: Array.from(this.agents.values()).map((agent) => agent.getInfo()),
      verified: this.verified,
      defaultMcpServers: this.defaultMcpServers,
    };
  }
}
