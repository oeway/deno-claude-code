#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read --allow-write

/**
 * Basic Example
 * Simple demonstration of creating an agent and sending a command
 */

import { AgentManager } from "../src/mod.ts";

async function basicExample() {
  console.log("🚀 Basic Claude Agent Example\n");

  // Create manager
  const manager = new AgentManager("./workspace");

  try {
    // Initialize and verify Claude CLI
    await manager.initialize();
    console.log("✅ Claude CLI verified\n");

    // Create an agent
    const agent = await manager.createAgent({
      permissionMode: "bypassPermissions", // Skip manual permissions for demo
    });

    console.log(`📦 Agent created: ${agent.id}`);
    console.log(`📁 Working directory: ${agent.workingDirectory}\n`);

    // Send a command
    console.log("💬 Sending command: 'Write a haiku about coding'\n");

    for await (
      const response of manager.sendCommand(
        agent.id,
        "Write a haiku about coding",
      )
    ) {
      if (response.type === "claude_json") {
        const data = response.data as any;

        if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                console.log("🤖 Response:");
                console.log(item.text);
              }
            }
          }
        }
      } else if (response.type === "done") {
        console.log("\n✅ Command completed");
      } else if (response.type === "error") {
        console.error(`❌ Error: ${response.error}`);
      }
    }

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent.id);
    console.log("✅ Agent removed");
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("\nMake sure Claude Code SDK is available:");
    console.error("  npm install @anthropic-ai/claude-code");
  }
}

// Run the example
if (import.meta.main) {
  basicExample();
}
