#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read --allow-write

/**
 * Advanced SDK Features Example
 * Demonstrates new capabilities in Claude Agent SDK:
 * - Programmatic subagents
 * - Custom system prompts
 * - Setting sources control
 * - Model selection
 * - Enhanced tool control
 */

import { AgentManager } from "../src/mod.ts";

async function advancedExample() {
  console.log("🚀 Advanced Claude Agent SDK Features\n");

  const manager = new AgentManager("./advanced-workspace");

  try {
    await manager.initialize();
    console.log("✅ Claude Agent SDK verified\n");

    // Example 1: Agent with programmatic subagents
    console.log("📋 Example 1: Agent with Programmatic Subagents");
    console.log("=" .repeat(60));

    const agentWithSubagents = await manager.createAgent({
      name: "MainAgent",
      permissionMode: "bypassPermissions",
      // Define subagents programmatically
      agents: {
        "code-reviewer": {
          description: "Expert code reviewer for quality and best practices",
          prompt: "You are an expert code reviewer. Focus on code quality, security, and best practices.",
          tools: ["Read", "Grep", "Glob"],
          model: "sonnet",
        },
        "test-writer": {
          description: "Specialized in writing comprehensive test cases",
          prompt: "You are a test writing specialist. Create thorough, well-documented tests.",
          tools: ["Read", "Write", "Grep"],
          model: "sonnet",
        },
      },
      // Use Claude Code's system prompt for coding tasks
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
      },
    });

    console.log(`✅ Agent with subagents created: ${agentWithSubagents.id}`);
    console.log("   Available subagents: code-reviewer, test-writer\n");

    // Example 2: Agent with custom system prompt
    console.log("📋 Example 2: Agent with Custom System Prompt");
    console.log("=" .repeat(60));

    const customAgent = await manager.createAgent({
      name: "CustomAssistant",
      permissionMode: "bypassPermissions",
      systemPrompt: "You are a friendly assistant specialized in data analysis. " +
        "Always explain your reasoning and provide clear visualizations when possible.",
      allowedTools: ["Read", "Write", "Bash"],
      maxTurns: 10,
    });

    console.log(`✅ Custom agent created: ${customAgent.id}`);
    console.log("   System prompt: Custom data analysis assistant\n");

    // Example 3: Agent with setting sources (loads CLAUDE.md from project)
    console.log("📋 Example 3: Agent with Project Settings");
    console.log("=" .repeat(60));

    const projectAgent = await manager.createAgent({
      name: "ProjectAgent",
      permissionMode: "acceptEdits",
      // Load project settings (CLAUDE.md, .claude/settings.json)
      settingSources: ["project"],
      // Must use Claude Code preset to interpret CLAUDE.md
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
      },
    });

    console.log(`✅ Project agent created: ${projectAgent.id}`);
    console.log("   Loads settings from: .claude/settings.json, CLAUDE.md\n");

    // Example 4: Agent with model selection and fallback
    console.log("📋 Example 4: Agent with Model Selection");
    console.log("=" .repeat(60));

    const modelAgent = await manager.createAgent({
      name: "SpecificModelAgent",
      permissionMode: "bypassPermissions",
      model: "claude-sonnet-4-5-20250929",
      fallbackModel: "claude-sonnet-3-5-20241022",
      maxThinkingTokens: 10000,
    });

    console.log(`✅ Model agent created: ${modelAgent.id}`);
    console.log("   Primary model: claude-sonnet-4-5-20250929");
    console.log("   Fallback model: claude-sonnet-3-5-20241022\n");

    // Example 5: Agent with enhanced tool control
    console.log("📋 Example 5: Agent with Enhanced Tool Control");
    console.log("=" .repeat(60));

    const restrictedAgent = await manager.createAgent({
      name: "RestrictedAgent",
      permissionMode: "default",
      // Allow most tools
      allowedTools: ["Read", "Grep", "Glob", "Write"],
      // But explicitly disallow potentially dangerous ones
      disallowedTools: ["Bash", "KillBash"],
    });

    console.log(`✅ Restricted agent created: ${restrictedAgent.id}`);
    console.log("   Allowed tools: Read, Grep, Glob, Write");
    console.log("   Disallowed tools: Bash, KillBash\n");

    // Example 6: Execute command with the agent with subagents
    console.log("📋 Example 6: Executing with Subagent Delegation");
    console.log("=" .repeat(60));

    console.log("💬 Command: 'Review the code in src/ directory'\n");

    for await (
      const response of manager.sendCommand(
        agentWithSubagents.id,
        "Review the code in the src/ directory and provide feedback",
      )
    ) {
      if (response.type === "agent") {
        const data = response.data as any;

        if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                console.log("🤖 Assistant:");
                console.log(item.text);
                console.log();
              } else if (item.type === "tool_use") {
                console.log(`🔧 Using tool: ${item.name}`);
              }
            }
          }
        } else if (data.type === "result") {
          if (data.subtype === "success") {
            console.log("✅ Command completed successfully");
            console.log(`   Cost: $${data.total_cost_usd?.toFixed(6)}`);
            console.log(`   Duration: ${data.duration_ms}ms`);
          }
        }
      } else if (response.type === "error") {
        console.error(`❌ Error: ${response.error}`);
      }
    }

    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await manager.removeAllAgents();
    console.log("✅ All agents removed");

    // Show summary
    console.log("\n" + "=" .repeat(60));
    console.log("📊 Summary of New SDK Features:");
    console.log("=" .repeat(60));
    console.log("✅ Programmatic subagents - delegate tasks to specialized agents");
    console.log("✅ Custom system prompts - tailor behavior to your needs");
    console.log("✅ Setting sources control - choose what config to load");
    console.log("✅ Model selection - specify models and fallbacks");
    console.log("✅ Enhanced tool control - fine-grained permission management");
    console.log("✅ Extended limits - configure maxTurns and maxThinkingTokens");

  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("\nMake sure Claude Agent SDK is available:");
    console.error("  npm install @anthropic-ai/claude-agent-sdk");
  }
}

// Run the example
if (import.meta.main) {
  advancedExample();
}
