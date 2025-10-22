/**
 * Agent Manager
 * Manages lifecycle of multiple Claude Code agents
 */

import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { Agent } from "./agent.ts";
import { WorkerAgentProxy } from "./worker-agent.ts";
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
  private agents: Map<string, WorkerAgentProxy> = new Map();
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
  async createAgent(options: CreateAgentOptions = {}): Promise<WorkerAgentProxy> {
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
      disallowedTools: options.disallowedTools,
      mcpServers: options.mcpServers,
      settingsTemplate: options.settingsTemplate,
      model: options.model,
      fallbackModel: options.fallbackModel,
      agents: options.agents,
      systemPrompt: options.systemPrompt,
      settingSources: options.settingSources,
      additionalDirectories: options.additionalDirectories,
      maxTurns: options.maxTurns,
      maxThinkingTokens: options.maxThinkingTokens,
      includePartialMessages: options.includePartialMessages,
      env: options.env,
    };

    // Ensure the working directory exists
    await ensureDir(agentConfig.workingDirectory);

    // Combine default MCP servers with agent-specific ones
    const allMcpServers = this.mergeMcpServers(
      this.defaultMcpServers,
      options.mcpServers || [],
    );

    // Update agent config with merged MCP servers
    // The SDK now handles MCP servers directly via options
    agentConfig.mcpServers = allMcpServers;

    // Get user home directory for npm cache
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
    const npmCacheDir = join(homeDir, "Library/Caches/deno/npm");
    
    // Create Deno permissions for the worker based on permission mode
    // IMPORTANT: The 'run' permission allows Claude Agent SDK to execute shell commands
    // which can bypass the file system sandbox.
    let permissions: Deno.PermissionOptions;

    switch (agentConfig.permissionMode) {
      case "bypassPermissions":
        // Full access - no sandbox
        permissions = {
          read: true,
          write: true,
          net: true,
          env: true,
          run: true,
          ffi: false,
        };
        break;

      case "default":
      case "acceptEdits":
      case "plan":
      default:
        // Default mode - balanced between functionality and security
        // WARNING: 'run: true' allows shell commands that can bypass the sandbox
        permissions = {
          read: [
            agentConfig.workingDirectory,
            npmCacheDir, // Allow reading npm modules
          ],
          write: [agentConfig.workingDirectory],
          net: allMcpServers.some(s => s.url) ? true : false,
          env: true, // Needed for Claude Agent SDK
          run: true, // Allows shell commands (needed for SDK)
          ffi: false,
        };
        break;
    }

    // Create the worker agent proxy
    const agentProxy = new WorkerAgentProxy(agentConfig, permissions);
    
    // Initialize the agent in the worker
    await agentProxy.initialize(agentConfig);
    
    this.agents.set(agentProxy.id, agentProxy);

    return agentProxy;
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): WorkerAgentProxy | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): WorkerAgentProxy[] {
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
      throw new Error(`Agent with id ${agentId} not found`);
    }

    yield* agent.execute(prompt, sessionId, permissionCallback, options);
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
    agent.terminate(); // Terminate the worker
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
      agent.terminate();
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
   * Note: MCP server configuration is now handled directly by the Claude Agent SDK
   * via the mcpServers option. No need to create .mcp.json files anymore.
   */

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
  async getInfo(): Promise<ManagerInfo> {
    return {
      baseDirectory: this.baseDirectory,
      agentCount: this.agents.size,
      agents: await Promise.all(
        Array.from(this.agents.values()).map((agent) => agent.getInfo())
      ),
      verified: this.verified,
      defaultMcpServers: this.defaultMcpServers,
    };
  }
}
