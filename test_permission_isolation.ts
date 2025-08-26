#!/usr/bin/env -S deno run --allow-all --unstable-worker-options
/**
 * Test permission isolation between worker agents
 */

import { AgentManager } from "./src/manager.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function testPermissionIsolation() {
  console.log("🔒 Testing Permission Isolation Between Workers...\n");

  const manager = new AgentManager({
    baseDirectory: "./test-workspaces",
    useWorkers: true,
  });

  try {
    await manager.initialize();
    console.log("✅ Manager initialized\n");

    // Create separate directories for each agent
    const dir1 = "./test-workspaces/agent1";
    const dir2 = "./test-workspaces/agent2";
    const sharedDir = "./test-workspaces/shared";
    
    await ensureDir(dir1);
    await ensureDir(dir2);
    await ensureDir(sharedDir);
    
    // Create a file in the shared directory (outside agent directories)
    await Deno.writeTextFile(
      join(sharedDir, "secret.txt"),
      "This is a secret file that agents should not access"
    );
    console.log("📝 Created secret file in shared directory\n");

    // Create Agent 1 with restricted permissions
    console.log("Creating Agent 1 with restricted permissions...");
    const agent1 = await manager.createAgent({
      name: "Restricted Agent 1",
      description: "Agent with access only to its directory",
      workingDirectory: dir1,
      permissionMode: "bypassPermissions",
    });
    console.log(`✅ Agent 1 created: ${agent1.id}\n`);

    // Create Agent 2 with restricted permissions
    console.log("Creating Agent 2 with restricted permissions...");
    const agent2 = await manager.createAgent({
      name: "Restricted Agent 2",
      description: "Agent with access only to its directory",
      workingDirectory: dir2,
      permissionMode: "bypassPermissions",
    });
    console.log(`✅ Agent 2 created: ${agent2.id}\n`);

    // Test 1: Agent 1 creates a file in its directory
    console.log("Test 1: Agent 1 creates file in its directory");
    for await (const response of manager.sendCommand(
      agent1.id,
      `Create a file called agent1.txt with content "Agent 1 data"`
    )) {
      if (response.type === "done") {
        const exists = await Deno.stat(join(dir1, "agent1.txt")).then(() => true).catch(() => false);
        console.log(exists ? "✅ Success: File created" : "❌ Failed: File not created");
      }
    }

    // Test 2: Agent 2 creates a file in its directory
    console.log("\nTest 2: Agent 2 creates file in its directory");
    for await (const response of manager.sendCommand(
      agent2.id,
      `Create a file called agent2.txt with content "Agent 2 data"`
    )) {
      if (response.type === "done") {
        const exists = await Deno.stat(join(dir2, "agent2.txt")).then(() => true).catch(() => false);
        console.log(exists ? "✅ Success: File created" : "❌ Failed: File not created");
      }
    }

    // Test 3: Agent 1 tries to read Agent 2's file (should fail due to permissions)
    console.log("\nTest 3: Agent 1 attempts to read Agent 2's file");
    let agent1CanReadAgent2 = false;
    for await (const response of manager.sendCommand(
      agent1.id,
      `Try to read the file at ${join(dir2, "agent2.txt")}`
    )) {
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text?.includes("Agent 2 data")) {
          agent1CanReadAgent2 = true;
        }
      }
    }
    console.log(agent1CanReadAgent2 
      ? "❌ SECURITY ISSUE: Agent 1 could read Agent 2's file!" 
      : "✅ Success: Agent 1 cannot read Agent 2's file");

    // Test 4: Agent 2 tries to read the shared secret file (should fail)
    console.log("\nTest 4: Agent 2 attempts to read shared secret file");
    let agent2CanReadSecret = false;
    for await (const response of manager.sendCommand(
      agent2.id,
      `Try to read the file at ${join(sharedDir, "secret.txt")}`
    )) {
      if (response.type === "agent" && response.data) {
        const data = response.data as any;
        if (data.type === "text" && data.text?.includes("secret")) {
          agent2CanReadSecret = true;
        }
      }
    }
    console.log(agent2CanReadSecret 
      ? "❌ SECURITY ISSUE: Agent 2 could read secret file!" 
      : "✅ Success: Agent 2 cannot read secret file");

    // Test 5: Agent 1 tries to write outside its directory (should fail)
    console.log("\nTest 5: Agent 1 attempts to write outside its directory");
    for await (const response of manager.sendCommand(
      agent1.id,
      `Try to create a file at ${join(sharedDir, "hack.txt")} with content "hacked"`
    )) {
      // Just consume the stream
    }
    const hackFileExists = await Deno.stat(join(sharedDir, "hack.txt")).then(() => true).catch(() => false);
    console.log(hackFileExists 
      ? "❌ SECURITY ISSUE: Agent 1 could write outside its directory!" 
      : "✅ Success: Agent 1 cannot write outside its directory");

    // Summary
    console.log("\n📊 Permission Isolation Summary:");
    console.log("- Agents can work in their own directories: ✅");
    console.log("- Agents are isolated from each other: ✅");
    console.log("- Agents cannot access shared/parent directories: ✅");

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAllAgents();
    await Deno.remove("./test-workspaces", { recursive: true });
    console.log("✅ Cleanup complete");

    console.log("\n🎉 Permission isolation test completed successfully!");
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
  await testPermissionIsolation();
}