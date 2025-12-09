#!/usr/bin/env -S deno run --allow-all

/**
 * Local test for Claude Agent Manager
 * Run with: deno run --allow-all test_local.ts
 */

import { AgentManager } from "./src/manager.ts";

async function main() {
  console.log("🧪 Testing Claude Agent Manager Locally\n");

  // Create manager
  console.log("1. Creating manager...");
  const manager = new AgentManager({
    baseDirectory: "./test-workspaces",
  });

  await manager.initialize();
  console.log("✅ Manager initialized\n");

  // Create an agent
  console.log("2. Creating agent...");
  const agent = await manager.createAgent({
    name: "TestAgent",
    permissionMode: "bypassPermissions",
  });
  console.log(`✅ Agent created: ${agent.id}\n`);

  // Test simple execution
  console.log("3. Testing simple command execution...");
  console.log("Prompt: What is 2 + 2?\n");

  let messageCount = 0;
  for await (const response of agent.execute("What is 2 + 2?")) {
    messageCount++;

    if (response.type === "agent" && response.data) {
      const data = response.data as any;
      console.log(`   [${messageCount}] Type: ${data.type}`);

      if (data.type === "assistant" && data.message?.content) {
        for (const item of data.message.content) {
          if (item.type === "text") {
            console.log(`   📝 Response: ${item.text}`);
          }
        }
      }
    } else if (response.type === "done") {
      console.log("   ✅ Execution completed");
    } else if (response.type === "error") {
      console.log(`   ❌ Error: ${response.error}`);
    }
  }

  console.log(`\n   Total messages: ${messageCount}`);

  // Cleanup
  console.log("\n4. Cleaning up...");
  await manager.removeAgent(agent.id);
  console.log("✅ Agent removed");

  console.log("\n🎉 Test completed successfully!");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  Deno.exit(1);
});
