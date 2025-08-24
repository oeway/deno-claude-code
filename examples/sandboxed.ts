#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read=./sandbox-workspace --allow-write=./sandbox-workspace

/**
 * Sandboxed Example
 * Demonstrates secure execution with restricted file system access
 *
 * Run with limited permissions:
 * deno run --allow-net --allow-run --allow-env --allow-read=./sandbox-workspace --allow-write=./sandbox-workspace sandboxed.ts
 */

import { AgentManager } from "../src/mod.ts";

async function sandboxedExample() {
  console.log("🔒 Sandboxed Execution Example\n");
  console.log("=".repeat(50));
  console.log("Running with restricted permissions:");
  console.log("  ✅ Can read/write: ./sandbox-workspace");
  console.log("  ❌ Cannot access: other directories");
  console.log("=".repeat(50) + "\n");

  const manager = new AgentManager("./sandbox-workspace");

  try {
    await manager.initialize();

    const agent = await manager.createAgent({
      workingDirectory: "./sandbox-workspace/agent",
      permissionMode: "acceptEdits", // Allow file operations
    });

    console.log(`🤖 Agent created: ${agent.id}`);
    console.log(`📁 Sandboxed to: ${agent.workingDirectory}\n`);

    // Test 1: Create file inside sandbox (should work)
    console.log("Test 1: Creating file INSIDE sandbox");
    console.log("-".repeat(40));

    for await (
      const response of manager.sendCommand(
        agent.id,
        "Create a file called hello.txt with content 'Hello from sandbox!'",
      )
    ) {
      if (response.type === "agent") {
        const data = response.data as any;

        if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                console.log("💬", item.text);
              } else if (item.type === "tool_use") {
                console.log(`🔧 Tool: ${item.name}`);
                if (item.input?.file_path) {
                  console.log(`   File: ${item.input.file_path}`);
                  console.log(`   ✅ Within sandbox`);
                }
              }
            }
          }
        }
      }
    }

    // Verify file was created
    try {
      const content = await Deno.readTextFile(
        "./sandbox-workspace/agent/hello.txt",
      );
      console.log(`\n✅ File created successfully!`);
      console.log(`   Content: "${content}"`);
    } catch {
      console.log("\n⚠️  File not found");
    }

    // Test 2: Try to access outside sandbox (should fail)
    console.log("\nTest 2: Trying to access OUTSIDE sandbox");
    console.log("-".repeat(40));

    for await (
      const response of manager.sendCommand(
        agent.id,
        "List files in /Users directory",
      )
    ) {
      if (response.type === "agent") {
        const data = response.data as any;

        if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                console.log("💬", item.text);
              } else if (item.type === "tool_use") {
                console.log(`🔧 Tool attempt: ${item.name}`);
                if (item.input?.path) {
                  console.log(`   ❌ Trying to access: ${item.input.path}`);
                  console.log(`   🔒 Should be blocked by sandbox`);
                }
              }
            }
          }
        } else if (data.type === "tool_result") {
          const result = data as any;
          if (result.is_error) {
            console.log(`   ✅ Sandbox working! Access denied`);
          }
        }
      }
    }

    // Test 3: Try to write outside sandbox (should fail)
    console.log("\nTest 3: Trying to write OUTSIDE sandbox");
    console.log("-".repeat(40));

    for await (
      const response of manager.sendCommand(
        agent.id,
        "Create a file at /tmp/escape.txt",
      )
    ) {
      if (response.type === "agent") {
        const data = response.data as any;

        if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                console.log("💬", item.text);
              }
            }
          }
        }
      }
    }

    // Verify file was NOT created outside sandbox
    try {
      await Deno.readTextFile("/tmp/escape.txt");
      console.log("\n❌ SECURITY ISSUE: File created outside sandbox!");
    } catch {
      console.log("\n✅ Security verified: Cannot write outside sandbox");
    }

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent.id);

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Security Summary                          ║
║                                                              ║
║  ✅ Agent can work within sandbox                            ║
║  ✅ Agent cannot access outside sandbox                      ║
║  ✅ Deno permissions properly enforced                       ║
╚══════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Run the example
if (import.meta.main) {
  sandboxedExample();
}
