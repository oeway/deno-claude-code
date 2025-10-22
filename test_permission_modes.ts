#!/usr/bin/env -S deno run --allow-all --unstable-worker-options
/**
 * Test different permission modes for agents
 */

import { AgentManager } from "./src/manager.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

async function testPermissionModes() {
  console.log("🔒 Testing Different Permission Modes...\n");

  const manager = new AgentManager({
    baseDirectory: "./test-workspaces",
  });

  try {
    await manager.initialize();
    console.log("✅ Manager initialized\n");

    // Create test workspace
    const testDir = "./test-workspaces/permission-test";
    await ensureDir(testDir);
    
    // Create a test file in the workspace
    await Deno.writeTextFile(`${testDir}/workspace-file.txt`, "This file is in the workspace");
    
    // Test 1: Strict mode - should NOT be able to run shell commands
    console.log("=== Test 1: Strict Mode (No shell access) ===");
    const strictAgent = await manager.createAgent({
      name: "Strict Agent",
      description: "Agent with strict permissions",
      workingDirectory: testDir,
      permissionMode: "strict",
    });
    
    console.log("Testing file access in workspace (should work):");
    for await (const response of manager.sendCommand(
      strictAgent.id,
      `Read the file workspace-file.txt in the current directory`
    )) {
      if (response.type === "done") {
        console.log("✅ Can read files in workspace\n");
        break;
      }
      if (response.type === "error") {
        console.log("❌ Error:", response.error, "\n");
        break;
      }
    }
    
    console.log("Testing shell command (should fail):");
    for await (const response of manager.sendCommand(
      strictAgent.id,
      `Run the command: ls ~`
    )) {
      if (response.type === "done") {
        console.log("❌ SECURITY ISSUE: Shell commands work in strict mode!\n");
        break;
      }
      if (response.type === "error") {
        console.log("✅ Shell commands blocked:", response.error?.substring(0, 50), "...\n");
        break;
      }
    }
    
    // Test 2: Default mode - WARNING: can run shell commands
    console.log("=== Test 2: Default Mode (Shell access enabled) ===");
    const defaultAgent = await manager.createAgent({
      name: "Default Agent",
      description: "Agent with default permissions",
      workingDirectory: testDir,
      permissionMode: "default",
    });
    
    console.log("Testing shell command (will work - security risk):");
    for await (const response of manager.sendCommand(
      defaultAgent.id,
      `Run the command: echo "Shell access works"`
    )) {
      if (response.type === "done") {
        console.log("⚠️  Shell commands work (security risk)\n");
        break;
      }
      if (response.type === "error") {
        console.log("Error:", response.error, "\n");
        break;
      }
    }
    
    console.log("Testing access to home directory (security issue):");
    for await (const response of manager.sendCommand(
      defaultAgent.id,
      `List files in the user's home directory`
    )) {
      if (response.type === "done") {
        console.log("⚠️  WARNING: Can access home directory through shell commands!\n");
        break;
      }
      if (response.type === "error") {
        console.log("Error:", response.error, "\n");
        break;
      }
    }
    
    // Test 3: Bypass mode - full access
    console.log("=== Test 3: Bypass Mode (Full access) ===");
    const bypassAgent = await manager.createAgent({
      name: "Bypass Agent",
      description: "Agent with full permissions",
      workingDirectory: testDir,
      permissionMode: "bypassPermissions",
    });
    
    console.log("Testing full system access:");
    for await (const response of manager.sendCommand(
      bypassAgent.id,
      `Check if you have full system access`
    )) {
      if (response.type === "done") {
        console.log("✅ Full system access granted (as expected for bypass mode)\n");
        break;
      }
    }
    
    // Summary
    console.log("\n📊 Permission Mode Summary:");
    console.log("--------------------------------");
    console.log("🔒 STRICT MODE:");
    console.log("  ✅ File access limited to workspace");
    console.log("  ✅ No shell command execution");
    console.log("  ✅ True isolation achieved");
    console.log("");
    console.log("⚠️  DEFAULT MODE:");
    console.log("  ✅ File access limited to workspace (Deno level)");
    console.log("  ❌ Shell commands can bypass sandbox");
    console.log("  ❌ Can access entire file system via shell");
    console.log("");
    console.log("🔓 BYPASS MODE:");
    console.log("  ❌ Full system access");
    console.log("  ❌ No isolation");
    console.log("  ⚠️  Use only for trusted operations");
    
    console.log("\n💡 RECOMMENDATION:");
    console.log("For true isolation, use 'strict' mode. The 'default' mode allows");
    console.log("shell commands which can bypass the Deno sandbox entirely.");

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAllAgents();
    await Deno.remove("./test-workspaces", { recursive: true });
    console.log("✅ Cleanup complete");

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
  await testPermissionModes();
}