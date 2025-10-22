/**
 * Type definitions for Claude Code Agent
 * Enhanced for the new @anthropic-ai/claude-agent-sdk
 */

/**
 * Permission modes matching Claude Agent SDK
 */
export type PermissionMode =
  | "default"         // Standard permission behavior
  | "acceptEdits"     // Auto-accept file edits
  | "bypassPermissions" // Bypass all permission checks
  | "plan";           // Planning mode - no execution

/**
 * Setting sources for filesystem-based configuration
 */
export type SettingSource = 'user' | 'project' | 'local';

/**
 * Agent definition for programmatic subagents
 */
export interface AgentDefinition {
  /** Natural language description of when to use this agent */
  description: string;
  /** Array of allowed tool names. If omitted, inherits all tools */
  tools?: string[];
  /** The agent's system prompt */
  prompt: string;
  /** Model override for this agent */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}

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
  /** Human-readable name for the agent */
  name?: string;
  /** Description of the agent's purpose */
  description?: string;
  /** Working directory for the agent */
  workingDirectory: string;
  /** Permission mode for tool usage */
  permissionMode?: PermissionMode;
  /** List of allowed tools */
  allowedTools?: string[];
  /** List of disallowed tools */
  disallowedTools?: string[];
  /** MCP servers configuration */
  mcpServers?: MCPServerConfig[];
  /** Settings template for claude.json */
  settingsTemplate?: Record<string, any>;
  /** Model to use (e.g., 'claude-sonnet-4-5-20250929') */
  model?: string;
  /** Fallback model if primary fails */
  fallbackModel?: string;
  /** Programmatically defined subagents */
  agents?: Record<string, AgentDefinition>;
  /** System prompt configuration */
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  /** Control which filesystem settings to load */
  settingSources?: SettingSource[];
  /** Additional directories Claude can access */
  additionalDirectories?: string[];
  /** Maximum conversation turns */
  maxTurns?: number;
  /** Maximum tokens for thinking process */
  maxThinkingTokens?: number;
  /** Include partial message events */
  includePartialMessages?: boolean;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Stream response from agent execution
 */
export interface StreamResponse {
  /** Type of response */
  type: "agent" | "error" | "done" | "aborted" | "permission_request";
  /** Data payload for agent type */
  data?: unknown;
  /** Error message for error type */
  error?: string;
  /** Permission request data */
  permissionRequest?: PermissionRequest;
}

/**
 * Permission request from Claude
 */
export interface PermissionRequest {
  /** Unique ID for this permission request */
  id: string;
  /** Tool name requesting permission */
  toolName: string;
  /** Patterns or commands being requested */
  patterns: string[];
  /** Tool use ID from Claude */
  toolUseId?: string;
  /** Additional context about what the tool wants to do */
  description?: string;
}

/**
 * User's response to a permission request
 */
export interface PermissionResponse {
  /** ID of the permission request being responded to */
  requestId: string;
  /** User's decision */
  action: "allow" | "allow_permanent" | "deny";
  /** Updated list of allowed tools if permanent */
  allowedTools?: string[];
}

/**
 * Callback for handling permission requests
 */
export type PermissionCallback = (
  request: PermissionRequest
) => Promise<PermissionResponse>;

/**
 * Options for creating a new agent
 */
export interface CreateAgentOptions {
  /** Human-readable name for the agent */
  name?: string;
  /** Description of the agent's purpose */
  description?: string;
  /** Working directory for the agent */
  workingDirectory?: string;
  /** Permission mode for tool usage */
  permissionMode?: PermissionMode;
  /** List of allowed tools */
  allowedTools?: string[];
  /** List of disallowed tools */
  disallowedTools?: string[];
  /** MCP servers configuration */
  mcpServers?: MCPServerConfig[];
  /** Settings template for claude.json */
  settingsTemplate?: Record<string, any>;
  /** Model to use */
  model?: string;
  /** Fallback model if primary fails */
  fallbackModel?: string;
  /** Programmatically defined subagents */
  agents?: Record<string, AgentDefinition>;
  /** System prompt configuration */
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  /** Control which filesystem settings to load */
  settingSources?: SettingSource[];
  /** Additional directories Claude can access */
  additionalDirectories?: string[];
  /** Maximum conversation turns */
  maxTurns?: number;
  /** Maximum tokens for thinking process */
  maxThinkingTokens?: number;
  /** Include partial message events */
  includePartialMessages?: boolean;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Agent information
 */
export interface AgentInfo {
  /** Unique agent ID */
  id: string;
  /** Human-readable name */
  name?: string;
  /** Description */
  description?: string;
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
