/**
 * Agent Manager
 * Single-threaded manager for Claude Code agents
 */

import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { Agent } from "./agent.ts";
import type {
  AgentConfig,
  CreateAgentOptions,
  ManagerConfig,
  ManagerInfo,
  MCPServerConfig,
  PermissionCallback,
  StreamResponse,
} from "./types.ts";

/**
 * Manager class for creating and managing multiple agents
 */
export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private baseDirectory: string;
  private verified = false;
  private defaultMcpServers: MCPServerConfig[];

  constructor(config?: ManagerConfig | string) {
    if (typeof config === "string" || config === undefined) {
      this.baseDirectory = config || "./agent-workspaces";
      this.defaultMcpServers = [];
    } else {
      this.baseDirectory = config.baseDirectory || "./agent-workspaces";
      this.defaultMcpServers = config.defaultMcpServers || [];
    }
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    await ensureDir(this.baseDirectory);
    this.verified = await Agent.verifyClaudeInstallation();

    if (!this.verified) {
      throw new Error("Claude Code SDK not found");
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(options: CreateAgentOptions = {}): Promise<Agent> {
    if (!this.verified) {
      await this.initialize();
    }

    const workingDirectory = options.workingDirectory ||
      join(this.baseDirectory, `agent-${Date.now()}`);

    await ensureDir(workingDirectory);

    const agentConfig: AgentConfig = {
      ...options,
      workingDirectory,
      mcpServers: this.mergeMcpServers(
        this.defaultMcpServers,
        options.mcpServers || [],
      ),
    };

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
    permissionCallback?: PermissionCallback,
    options?: { allowedTools?: string[] },
  ): AsyncGenerator<StreamResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    yield* agent.execute(prompt, sessionId, permissionCallback, options);
  }

  /**
   * Stop an agent's current execution
   */
  stopAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    agent.abort();
    return true;
  }

  /**
   * Remove an agent
   */
  async removeAgent(id: string, keepDirectory = false): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) return false;

    agent.abort();
    this.agents.delete(id);

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
   * Clean up manager
   */
  async cleanup(): Promise<void> {
    for (const agent of this.agents.values()) {
      agent.abort();
    }

    this.agents.clear();

    try {
      await Deno.remove(this.baseDirectory, { recursive: true });
    } catch (error) {
      console.error(`Failed to remove base directory: ${error}`);
    }
  }

  /**
   * Merge MCP servers
   */
  private mergeMcpServers(
    defaultServers: MCPServerConfig[],
    agentServers: MCPServerConfig[],
  ): MCPServerConfig[] {
    const serverMap = new Map<string, MCPServerConfig>();

    for (const server of defaultServers) {
      serverMap.set(server.name, server);
    }

    for (const server of agentServers) {
      serverMap.set(server.name, server);
    }

    return Array.from(serverMap.values());
  }

  /**
   * Get manager information
   */
  async getInfo(): Promise<ManagerInfo> {
    return {
      baseDirectory: this.baseDirectory,
      agentCount: this.agents.size,
      agents: this.getAllAgents().map((agent) => agent.getInfo()),
      verified: this.verified,
      defaultMcpServers: this.defaultMcpServers,
    };
  }
}
