/**
 * Claude Code Agent
 * Uses the Claude Code SDK query function with settings.json for configuration
 */

import { query } from "npm:@anthropic-ai/claude-code@1.0.89";
import type {
  AgentConfig,
  AgentInfo,
  PermissionMode,
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
  readonly workingDirectory: string;
  private permissionMode: PermissionMode;
  private allowedTools?: string[];
  private abortController: AbortController | null = null;
  private conversation: ConversationMessage[] = [];
  private currentSessionId?: string;

  constructor(config: AgentConfig) {
    this.id = config.id || globalThis.crypto.randomUUID();
    this.workingDirectory = config.workingDirectory;
    this.permissionMode = config.permissionMode || "default";
    this.allowedTools = config.allowedTools;
  }

  /**
   * Execute a command using the Claude Code SDK query function
   * Settings are configured via settings.json in the working directory
   */
  async *execute(
    prompt: string,
    sessionId?: string,
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

      // Use the Claude Code SDK query function
      for await (
        const sdkMessage of query({
          prompt,
          options: {
            abortController: this.abortController,
            cwd: this.workingDirectory,
            permissionMode: this.permissionMode,
            ...(sessionId ? { resume: sessionId } : {}),
            ...(this.allowedTools ? { allowedTools: this.allowedTools } : {}),
          },
        })
      ) {
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
        "npm:@anthropic-ai/claude-code@1.0.89"
      );
      return typeof testQuery === "function";
    } catch (error) {
      console.error("Claude Code SDK not available:", error);
      return false;
    }
  }
}
