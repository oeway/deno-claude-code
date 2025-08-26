#!/usr/bin/env -S deno run --allow-all --unstable-worker-options
/**
 * Simple test to verify worker-based agents are functioning
 */

import { AgentManager } from "./src/manager.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function testSimpleWorker() {
  console.log("🧪 Testing Simple Worker Agent...\n");

  const manager = new AgentManager({
    baseDirectory: "./test-workspaces",
    useWorkers: true,
  });

  try {
    await manager.initialize();
    console.log("✅ Manager initialized\n");

    // Create an agent
    console.log("Creating test agent...");
    const agent = await manager.createAgent({
      name: "Test Agent",
      description: "Simple test agent",
      workingDirectory: "./test-workspaces/test-agent",
      permissionMode: "bypassPermissions", // Bypass permissions for testing
    });
    console.log(`✅ Agent created with ID: ${agent.id}`);
    console.log(`📁 Working directory: ${agent.workingDirectory}\n`);

    // Send a simple command
    console.log("Sending test command to agent...");
    const responses: any[] = [];
    
    for await (const response of manager.sendCommand(
      agent.id,
      `Tell me your working directory and create a file called hello.txt with content "Hello from worker"`
    )) {
      responses.push(response);
      
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text) {
          console.log("Agent:", data.text.substring(0, 100));
        }
        if (data.type === "tool_use") {
          console.log(`Agent using tool: ${data.name}`);
        }
      } else if (response.type === "error") {
        console.error("Error:", response.error);
      } else if (response.type === "done") {
        console.log("✅ Command completed");
      }
    }

    // Check if file was created
    try {
      const filePath = join(agent.workingDirectory, "hello.txt");
      const content = await Deno.readTextFile(filePath);
      console.log(`\n✅ File created successfully with content: "${content}"`);
    } catch (error) {
      console.log(`\n❌ File was not created: ${error}`);
    }

    // Get agent info
    const agentInfo = await agent.getInfo();
    console.log("\n📊 Agent Information:");
    console.log(`  ID: ${agentInfo.id}`);
    console.log(`  Name: ${agentInfo.name}`);
    console.log(`  Working Directory: ${agentInfo.workingDirectory}`);
    console.log(`  Permission Mode: ${agentInfo.permissionMode}`);

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent.id);
    console.log("✅ Agent removed");

    await Deno.remove("./test-workspaces", { recursive: true });
    console.log("✅ Test directories cleaned up");

    console.log("\n🎉 Simple worker test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    
    // Clean up on error
    try {
      await manager.cleanup();
      await Deno.remove("./test-workspaces", { recursive: true }).catch(() => {});
    } catch {}
  }
}

// Run the test
if (import.meta.main) {
  await testSimpleWorker();
}