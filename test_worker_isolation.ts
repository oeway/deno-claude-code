#!/usr/bin/env -S deno run --allow-all --unstable-worker-options
/**
 * Test file for verifying agent worker isolation and permissions
 */

import { AgentManager } from "./src/manager.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function testWorkerIsolation() {
  console.log("🧪 Testing Agent Worker Isolation...\n");

  // Create manager
  const manager = new AgentManager({
    baseDirectory: "./test-workspaces",
    useWorkers: true, // Explicitly enable workers
  });

  try {
    await manager.initialize();
    console.log("✅ Manager initialized\n");

    // Create test directories
    const testDir1 = "./test-workspaces/agent1";
    const testDir2 = "./test-workspaces/agent2";
    await ensureDir(testDir1);
    await ensureDir(testDir2);

    // Create first agent with limited permissions
    console.log("Creating Agent 1 with permissions only for its directory...");
    const agent1 = await manager.createAgent({
      name: "Agent 1",
      description: "Test agent with limited permissions",
      workingDirectory: testDir1,
      permissionMode: "default",
    });
    console.log(`✅ Agent 1 created with ID: ${agent1.id}\n`);

    // Create second agent with different permissions
    console.log("Creating Agent 2 with permissions only for its directory...");
    const agent2 = await manager.createAgent({
      name: "Agent 2",
      description: "Another test agent with limited permissions",
      workingDirectory: testDir2,
      permissionMode: "default",
    });
    console.log(`✅ Agent 2 created with ID: ${agent2.id}\n`);

    // Test Agent 1 - should be able to work in its directory
    console.log("Testing Agent 1 - Creating file in its directory...");
    const responses1: any[] = [];
    for await (const response of manager.sendCommand(
      agent1.id,
      `Create a file called test1.txt in the current directory with content "Agent 1 was here"`,
    )) {
      responses1.push(response);
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text) {
          console.log("Agent 1:", data.text);
        }
      }
    }

    // Verify file was created
    try {
      const content1 = await Deno.readTextFile(join(testDir1, "test1.txt"));
      console.log(`✅ Agent 1 successfully created file: ${content1}\n`);
    } catch (error) {
      console.log(`❌ Agent 1 failed to create file: ${error}\n`);
    }

    // Test Agent 1 - should NOT be able to access Agent 2's directory
    console.log("Testing Agent 1 - Attempting to access Agent 2's directory (should fail)...");
    const responses2: any[] = [];
    for await (const response of manager.sendCommand(
      agent1.id,
      `Try to read or create a file in ${testDir2}`,
    )) {
      responses2.push(response);
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text) {
          console.log("Agent 1:", data.text);
        }
      }
    }

    // Test Agent 2 - should be able to work in its directory
    console.log("\nTesting Agent 2 - Creating file in its directory...");
    const responses3: any[] = [];
    for await (const response of manager.sendCommand(
      agent2.id,
      `Create a file called test2.txt in the current directory with content "Agent 2 was here"`,
    )) {
      responses3.push(response);
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text) {
          console.log("Agent 2:", data.text);
        }
      }
    }

    // Verify file was created
    try {
      const content2 = await Deno.readTextFile(join(testDir2, "test2.txt"));
      console.log(`✅ Agent 2 successfully created file: ${content2}\n`);
    } catch (error) {
      console.log(`❌ Agent 2 failed to create file: ${error}\n`);
    }

    // Test Agent 2 - should NOT be able to access Agent 1's directory
    console.log("Testing Agent 2 - Attempting to access Agent 1's directory (should fail)...");
    const responses4: any[] = [];
    for await (const response of manager.sendCommand(
      agent2.id,
      `Try to read the file ${join(testDir1, "test1.txt")}`,
    )) {
      responses4.push(response);
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text) {
          console.log("Agent 2:", data.text);
        }
      }
    }

    // Get agent info
    console.log("\n📊 Agent Information:");
    const agent1Info = await agent1.getInfo();
    console.log("Agent 1:", agent1Info);
    const agent2Info = await agent2.getInfo();
    console.log("Agent 2:", agent2Info);

    // Get manager info
    const managerInfo = await manager.getInfo();
    console.log("\n📊 Manager Information:");
    console.log(`Base Directory: ${managerInfo.baseDirectory}`);
    console.log(`Agent Count: ${managerInfo.agentCount}`);
    console.log(`Verified: ${managerInfo.verified}`);

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent1.id);
    await manager.removeAgent(agent2.id);
    console.log("✅ Agents removed");

    // Clean up test directories
    await Deno.remove("./test-workspaces", { recursive: true });
    console.log("✅ Test directories cleaned up");

    console.log("\n🎉 Worker isolation test completed successfully!");
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
  await testWorkerIsolation();
}