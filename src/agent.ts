/**
 * Claude Code Agent
 * Uses the Claude Code SDK query function with settings.json for configuration
 */

import { query } from "npm:@anthropic-ai/claude-code@1.0.77";
import type {
  AgentConfig,
  AgentInfo,
  PermissionMode,
  StreamResponse,
} from "./types.ts";

/**
 * Agent class for executing Claude commands using the Claude Code SDK
 */
export class Agent {
  readonly id: string;
  readonly workingDirectory: string;
  private permissionMode: PermissionMode;
  private allowedTools?: string[];
  private abortController: AbortController | null = null;

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
        // Stream each SDK message as claude_json type
        yield {
          type: "claude_json",
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
   * Check if Claude Code SDK is available
   */
  static async verifyClaudeInstallation(): Promise<boolean> {
    try {
      // Check if we can import the SDK
      const { query: testQuery } = await import(
        "npm:@anthropic-ai/claude-code@1.0.77"
      );
      return typeof testQuery === "function";
    } catch (error) {
      console.error("Claude Code SDK not available:", error);
      return false;
    }
  }
}
