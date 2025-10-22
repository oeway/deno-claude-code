#!/usr/bin/env -S deno run --allow-all --unstable-worker-options
/**
 * Test for worker-based agent implementation
 */

import { AgentManager } from "./src/manager.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function testWorkerAgent() {
  console.log("🔗 Testing Worker Agent...\n");

  const manager = new AgentManager({
    baseDirectory: "./test-workspaces",
  });

  try {
    await manager.initialize();
    console.log("✅ Manager initialized\n");

    // Create an agent
    console.log("Creating test agent...");
    const agent = await manager.createAgent({
      name: "Test Agent",
      description: "Agent using worker isolation",
      workingDirectory: "./test-workspaces/test-agent",
      permissionMode: "bypassPermissions",
    });
    console.log(`✅ Agent created with ID: ${agent.id}`);
    console.log(`📁 Working directory: ${agent.workingDirectory}\n`);

    // Test 1: Send a simple command
    console.log("Test 1: Sending simple command...");
    let commandWorked = false;
    
    for await (const response of manager.sendCommand(
      agent.id,
      `Create a file called test.txt with content "Hello from worker"`
    )) {
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text) {
          console.log("Agent response:", data.text.substring(0, 100));
        }
        if (data.type === "tool_use") {
          console.log(`Agent using tool: ${data.name}`);
        }
      } else if (response.type === "done") {
        commandWorked = true;
        console.log("✅ Command completed");
      } else if (response.type === "error") {
        console.error("❌ Error:", response.error);
      }
    }

    // Verify file was created
    if (commandWorked) {
      try {
        const filePath = join(agent.workingDirectory, "test.txt");
        const content = await Deno.readTextFile(filePath);
        console.log(`✅ File created with content: "${content}"\n`);
      } catch (error) {
        console.log(`❌ File was not created: ${error}\n`);
      }
    }

    // Test 2: Test abort functionality
    console.log("Test 2: Testing abort functionality...");
    
    // Start a long-running command
    const longCommand = manager.sendCommand(
      agent.id,
      `Count from 1 to 100 slowly`
    );
    
    // Let it run for a bit then abort
    setTimeout(async () => {
      console.log("Aborting command...");
      await agent.abort();
    }, 1000);
    
    let wasAborted = false;
    for await (const response of longCommand) {
      if (response.type === "aborted") {
        wasAborted = true;
        console.log("✅ Command was aborted");
        break;
      }
      if (response.type === "done") {
        console.log("Command completed (not aborted)");
        break;
      }
    }

    // Test 3: Get agent info
    console.log("\nTest 3: Getting agent info...");
    const agentInfo = await agent.getInfo();
    console.log("Agent Information:");
    console.log(`  ID: ${agentInfo.id}`);
    console.log(`  Name: ${agentInfo.name}`);
    console.log(`  Working Directory: ${agentInfo.workingDirectory}`);
    console.log(`  Permission Mode: ${agentInfo.permissionMode}`);

    // Test 4: Conversation management
    console.log("\nTest 4: Testing conversation management...");
    
    // Get initial conversation
    const initialConversation = await agent.getConversation();
    console.log(`Initial conversation length: ${initialConversation.length}`);
    
    // Clear conversation
    await agent.clearConversation();
    const clearedConversation = await agent.getConversation();
    console.log(`Conversation after clearing: ${clearedConversation.length}`);
    
    // Get session ID
    const sessionId = await agent.getSessionId();
    console.log(`Session ID: ${sessionId || "None"}`);

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent.id);
    console.log("✅ Agent removed");

    await Deno.remove("./test-workspaces", { recursive: true });
    console.log("✅ Test directories cleaned up");

    console.log("\n🎉 Worker test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    
    // Clean up on error
    try {
      await manager.cleanup();
      await Deno.remove("./test-workspaces", { recursive: true }).catch(() => {});
    } catch {}
  }
}


// Run the tests
if (import.meta.main) {
  await testWorkerAgent();
}