#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read --allow-write

/**
 * Streaming Example
 * Demonstrates real-time streaming of responses and multi-turn conversations
 */

import { AgentManager } from "../src/mod.ts";

// Helper to format messages for display
function formatMessage(data: any): string {
  if (data.type === "system") {
    return `Session: ${data.session_id || "new"}, Tools: ${
      data.tools?.length || 0
    }`;
  } else if (data.type === "assistant") {
    const content = data.message?.content;
    if (Array.isArray(content)) {
      return content.map((item: any) => {
        if (item.type === "text") {
          return item.text;
        } else if (item.type === "tool_use") {
          return `[Using tool: ${item.name}]`;
        }
        return "";
      }).join("");
    }
    return "";
  } else if (data.type === "result") {
    return `Completed: ${data.subtype}`;
  }
  return "";
}

async function streamingExample() {
  console.log("🔄 Streaming Example\n");
  console.log("=".repeat(50));

  const manager = new AgentManager("./streaming-workspace");

  try {
    await manager.initialize();

    const agent = await manager.createAgent({
      permissionMode: "bypassPermissions",
    });

    console.log(`✅ Agent created: ${agent.id}`);
    console.log(`📁 Working in: ${agent.workingDirectory}\n`);

    // Example 1: Simple streaming
    console.log("📝 Example 1: Simple Question");
    console.log("-".repeat(40));

    let sessionId: string | undefined;

    for await (
      const response of manager.sendCommand(
        agent.id,
        "What is TypeScript and why is it useful?",
      )
    ) {
      if (response.type === "claude_json") {
        const data = response.data as any;

        // Capture session ID for conversation continuity
        if (data.session_id) {
          sessionId = data.session_id;
        }

        // Display different message types
        if (data.type === "system") {
          console.log("⚙️  System:", formatMessage(data));
        } else if (data.type === "assistant") {
          console.log("🤖 Assistant:", formatMessage(data));
        } else if (data.type === "result") {
          console.log("✅ Result:", formatMessage(data));
        }
      }
    }

    // Example 2: Multi-turn conversation
    console.log("\n📝 Example 2: Multi-turn Conversation");
    console.log("-".repeat(40));

    const questions = [
      "Remember the number 42 and the color blue",
      "What number and color did I ask you to remember?",
    ];

    for (const question of questions) {
      console.log(`\n👤 User: ${question}`);

      for await (
        const response of manager.sendCommand(
          agent.id,
          question,
          sessionId, // Use same session for context
        )
      ) {
        if (response.type === "claude_json") {
          const data = response.data as any;

          if (data.type === "assistant") {
            console.log("🤖 Claude:", formatMessage(data));
          }
        }
      }
    }

    // Example 3: Code generation with streaming
    console.log("\n📝 Example 3: Code Generation");
    console.log("-".repeat(40));
    console.log("Generating TypeScript code...\n");

    for await (
      const response of manager.sendCommand(
        agent.id,
        "Write a TypeScript function to calculate factorial",
        sessionId,
      )
    ) {
      if (response.type === "claude_json") {
        const data = response.data as any;

        if (data.type === "assistant") {
          const formatted = formatMessage(data);
          // Stream character by character for effect
          process.stdout.write("🤖 ");
          for (const char of formatted) {
            process.stdout.write(char);
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
          console.log();
        }
      }
    }

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent.id);
    console.log("✅ Done!");
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Run the example
if (import.meta.main) {
  streamingExample();
}
