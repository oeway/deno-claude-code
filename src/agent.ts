/**
 * Claude Code Agent
 * Uses the Claude Code SDK query function with settings.json for configuration
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  AgentConfig,
  AgentInfo,
  PermissionCallback,
  PermissionMode,
  PermissionRequest,
  StreamResponse,
} from "./types.ts";

export interface ConversationMessage {
  type: "user" | "agent";
  data?: any;
  timestamp: number;
}

/**
 * Agent class for executing Claude commands using the Claude Code SDK
 */
export class Agent {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly workingDirectory: string;
  readonly permissionMode: PermissionMode;
  private allowedTools?: string[];
  private disallowedTools?: string[];
  private config: AgentConfig;
  private abortController: AbortController | null = null;
  private conversation: ConversationMessage[] = [];
  private currentSessionId?: string;

  constructor(config: AgentConfig) {
    this.id = config.id || globalThis.crypto.randomUUID();
    this.name = config.name;
    this.description = config.description;
    this.workingDirectory = config.workingDirectory;
    this.permissionMode = config.permissionMode || "default";
    this.allowedTools = config.allowedTools;
    this.disallowedTools = config.disallowedTools;
    this.config = config;
  }

  /**
   * Execute a command using the Claude Agent SDK query function
   * Settings are configured via options passed to the SDK
   */
  async *execute(
    prompt: string,
    sessionId?: string,
    permissionCallback?: PermissionCallback,
    options?: { allowedTools?: string[] },
  ): AsyncGenerator<StreamResponse> {
    try {
      this.abortController = new AbortController();
      this.currentSessionId = sessionId;

      // Add user message to conversation
      this.conversation.push({
        type: "user",
        data: prompt,
        timestamp: Date.now(),
      });

      // Track allowed tools for this session - merge provided options with agent's allowed tools
      let sessionAllowedTools = [...(this.allowedTools || []), ...(options?.allowedTools || [])];

      // Build environment variables for SDK subprocess
      // Always include ANTHROPIC_API_KEY if available from environment
      const sdkEnv: Record<string, string> = {};
      const anthropicKey = (globalThis as any).Deno?.env.get("ANTHROPIC_API_KEY") ||
                          (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        sdkEnv.ANTHROPIC_API_KEY = anthropicKey;
      }
      // Merge with config env
      if (this.config.env) {
        Object.assign(sdkEnv, this.config.env);
      }

      // Build SDK options from agent config
      const sdkOptions: any = {
        abortController: this.abortController,
        cwd: this.workingDirectory,
        permissionMode: this.permissionMode,
        ...(sessionId ? { resume: sessionId } : {}),
        ...(sessionAllowedTools.length > 0 ? { allowedTools: sessionAllowedTools } : {}),
        ...(this.disallowedTools && this.disallowedTools.length > 0 ? { disallowedTools: this.disallowedTools } : {}),
        ...(this.config.model ? { model: this.config.model } : {}),
        ...(this.config.fallbackModel ? { fallbackModel: this.config.fallbackModel } : {}),
        ...(this.config.agents ? { agents: this.config.agents } : {}),
        ...(this.config.systemPrompt ? { systemPrompt: this.config.systemPrompt } : {}),
        ...(this.config.settingSources ? { settingSources: this.config.settingSources } : {}),
        ...(this.config.additionalDirectories ? { additionalDirectories: this.config.additionalDirectories } : {}),
        ...(this.config.maxTurns ? { maxTurns: this.config.maxTurns } : {}),
        ...(this.config.maxThinkingTokens ? { maxThinkingTokens: this.config.maxThinkingTokens } : {}),
        ...(this.config.includePartialMessages ? { includePartialMessages: this.config.includePartialMessages } : {}),
        ...(Object.keys(sdkEnv).length > 0 ? { env: sdkEnv } : {}),
      };

      // MCP servers disabled for now - causes "ProcessTransport output stream not available" error
      // See: https://github.com/anthropics/claude-agent-sdk-python/issues/386
      // TODO: Re-enable once SDK fix is available
      // if (this.config.mcpServers && this.config.mcpServers.length > 0) {
      //   sdkOptions.mcpServers = {};
      //   for (const server of this.config.mcpServers) {
      //     if (server.url) {
      //       const serverType = server.transport === "http" || !server.transport ? "http" : "sse";
      //       sdkOptions.mcpServers[server.name] = {
      //         type: serverType,
      //         url: server.url,
      //       };
      //     } else if (server.command) {
      //       sdkOptions.mcpServers[server.name] = {
      //         type: "stdio",
      //         command: server.command,
      //         args: server.args || [],
      //         env: server.env || {},
      //       };
      //     }
      //   }
      // }

      // Convert string prompt to async generator to avoid ProcessTransport timing issues
      // See: https://github.com/anthropics/claude-agent-sdk-python/issues/386
      async function* wrapPrompt(text: string) {
        yield {
          type: "user" as const,
          message: {
            role: "user" as const,
            content: text,
          },
        };
      }

      // Use the Claude Agent SDK query function
      for await (
        const sdkMessage of query({
          prompt: wrapPrompt(prompt),
          options: sdkOptions,
        })
      ) {
        // Check if this is a permission request
        if (this.isPermissionRequest(sdkMessage)) {
          if (permissionCallback) {
            // Extract permission details from the SDK message
            const permissionRequest = this.extractPermissionRequest(sdkMessage);
            
            // Yield permission request to the stream
            yield {
              type: "permission_request",
              permissionRequest,
            };

            // Wait for user's response
            const response = await permissionCallback(permissionRequest);
            
            // Handle the response
            if (response.action === "allow" || response.action === "allow_permanent") {
              // Add the tool to allowed tools for this session
              const toolPattern = this.createToolPattern(permissionRequest);
              sessionAllowedTools.push(toolPattern);
              
              // If permanent, update the agent's allowed tools
              if (response.action === "allow_permanent") {
                if (!this.allowedTools) {
                  this.allowedTools = [];
                }
                this.allowedTools.push(toolPattern);
              }
              
              // Continue execution with updated permissions
              // Note: We need to restart the query with new allowed tools
              // This is a limitation - we might need to handle this differently
            } else {
              // Permission denied - execution will likely fail
              // Claude SDK will handle this appropriately
            }
          }
        }
        
        // Store all Claude messages in conversation
        this.conversation.push({
          type: "agent",
          data: sdkMessage,
          timestamp: Date.now(),
        });
        
        // Stream each SDK message as agent type
        yield {
          type: "agent",
          data: sdkMessage,
        };
      }

      yield { type: "done" };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        yield { type: "aborted" };
      } else {
        yield {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Check if an SDK message is a permission request
   */
  private isPermissionRequest(sdkMessage: any): boolean {
    // Check for permission-related patterns in the SDK message
    // This might be a system message with permission info
    if (sdkMessage.type === "system" && sdkMessage.subtype === "permission_required") {
      return true;
    }
    
    // Check for tool_use messages that might need permission
    if (sdkMessage.type === "tool_use" && sdkMessage.needsPermission) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract permission request details from SDK message
   */
  private extractPermissionRequest(sdkMessage: any): PermissionRequest {
    const requestId = globalThis.crypto.randomUUID();
    
    // Extract tool name and patterns based on message structure
    let toolName = "Unknown Tool";
    let patterns: string[] = [];
    let description = "";
    
    if (sdkMessage.type === "system" && sdkMessage.subtype === "permission_required") {
      toolName = sdkMessage.tool || "Unknown Tool";
      patterns = sdkMessage.patterns || [];
      description = sdkMessage.description || "";
    } else if (sdkMessage.type === "tool_use") {
      toolName = sdkMessage.name || "Unknown Tool";
      // For tool_use, we might need to construct patterns from the input
      if (sdkMessage.input && sdkMessage.name === "Bash") {
        patterns = [`Bash(${sdkMessage.input.command || "*"}:*)`];
      } else {
        patterns = [toolName];
      }
    }
    
    return {
      id: requestId,
      toolName,
      patterns,
      toolUseId: sdkMessage.id,
      description,
    };
  }

  /**
   * Create a tool pattern for allowed tools list
   */
  private createToolPattern(request: PermissionRequest): string {
    // If we have specific patterns, use the first one
    if (request.patterns.length > 0) {
      return request.patterns[0];
    }
    // Otherwise, use the tool name
    return request.toolName;
  }

  /**
   * Abort the current execution
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get agent information
   */
  getInfo(): AgentInfo {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      workingDirectory: this.workingDirectory,
      permissionMode: this.permissionMode,
      allowedTools: this.allowedTools,
    };
  }
  
  /**
   * Get the current conversation history
   */
  getConversation(): ConversationMessage[] {
    return [...this.conversation];
  }
  
  /**
   * Get the current session ID
   */
  getSessionId(): string | undefined {
    return this.currentSessionId;
  }
  
  /**
   * Clear the conversation history
   */
  clearConversation(): void {
    this.conversation = [];
    this.currentSessionId = undefined;
  }
  
  /**
   * Set conversation history (for restoration)
   */
  setConversation(messages: ConversationMessage[]): void {
    this.conversation = [...messages];
  }

  /**
   * Check if Claude Code SDK is available
   */
  static async verifyClaudeInstallation(): Promise<boolean> {
    try {
      // Check if we can import the SDK
      const { query: testQuery } = await import(
        "@anthropic-ai/claude-agent-sdk"
      );
      return typeof testQuery === "function";
    } catch (error) {
      console.error("Claude Code SDK not available:", error);
      return false;
    }
  }
}
