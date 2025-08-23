/**
 * Type definitions for Claude Code Agent
 */

/**
 * Permission modes matching Claude CLI
 */
export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan";

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Name identifier for the server */
  name: string;
  /** URL of the MCP server (for HTTP/SSE servers) */
  url?: string;
  /** Command to execute (for stdio servers) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Transport protocol */
  transport?: "http" | "ws" | "stdio";
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique identifier for the agent */
  id?: string;
  /** Working directory for the agent */
  workingDirectory: string;
  /** Permission mode for tool usage */
  permissionMode?: PermissionMode;
  /** List of allowed tools */
  allowedTools?: string[];
  /** MCP servers configuration */
  mcpServers?: MCPServerConfig[];
}

/**
 * Stream response from agent execution
 */
export interface StreamResponse {
  /** Type of response */
  type: "claude_json" | "error" | "done" | "aborted";
  /** Data payload for claude_json type */
  data?: unknown;
  /** Error message for error type */
  error?: string;
}

/**
 * Options for creating a new agent
 */
export interface CreateAgentOptions {
  /** Working directory for the agent */
  workingDirectory?: string;
  /** Permission mode for tool usage */
  permissionMode?: PermissionMode;
  /** List of allowed tools */
  allowedTools?: string[];
  /** MCP servers configuration */
  mcpServers?: MCPServerConfig[];
}

/**
 * Agent information
 */
export interface AgentInfo {
  /** Unique agent ID */
  id: string;
  /** Agent's working directory */
  workingDirectory: string;
  /** Permission mode */
  permissionMode: PermissionMode;
  /** Allowed tools */
  allowedTools?: string[];
}

/**
 * Manager configuration
 */
export interface ManagerConfig {
  /** Base directory for all agents */
  baseDirectory?: string;
  /** Default MCP servers for all agents */
  defaultMcpServers?: MCPServerConfig[];
  /** Path to settings template */
  settingsTemplatePath?: string;
}

/**
 * Manager information
 */
export interface ManagerInfo {
  /** Base directory for all agents */
  baseDirectory: string;
  /** Number of active agents */
  agentCount: number;
  /** List of all agents */
  agents: AgentInfo[];
  /** Whether Claude Code SDK is verified */
  verified: boolean;
  /** Default MCP servers */
  defaultMcpServers?: MCPServerConfig[];
}
