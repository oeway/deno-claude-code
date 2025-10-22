#!/usr/bin/env -S deno run --allow-all

import { AgentManager } from "./src/mod.ts";

async function testMcpFlow() {
  console.log("Testing MCP server configuration flow...\n");
  
  const manager = new AgentManager({
    baseDirectory: "/tmp/test-agents",
    defaultMcpServers: []
  });
  
  await manager.initialize();
  
  // Create an agent with MCP servers (mimicking what the UI sends)
  const agent = await manager.createAgent({
    name: "Test MCP Agent",
    description: "Testing MCP configuration",
    workingDirectory: "/tmp/test-mcp-agent",
    permissionMode: "default",
    mcpServers: [
      {
        name: "filesystem",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: {
          "ALLOWED_DIRECTORIES": "/tmp,/home"
        }
      }
    ],
    allowedTools: ["Read", "Write"]
  });
  
  console.log(`✅ Agent created: ${agent.id}`);
  console.log(`📁 Working directory: ${agent.workingDirectory}`);
  
  // Check if .mcp.json was created
  try {
    const mcpConfig = await Deno.readTextFile("/tmp/test-mcp-agent/.mcp.json");
    console.log("\n📄 Created .mcp.json:");
    console.log(mcpConfig);
    
    // Parse and verify structure
    const parsed = JSON.parse(mcpConfig);
    if (parsed.mcpServers && parsed.mcpServers.filesystem) {
      console.log("\n✅ MCP server configuration is correct!");
      console.log("   - Server name: filesystem");
      console.log("   - Type:", parsed.mcpServers.filesystem.type);
      console.log("   - Command:", parsed.mcpServers.filesystem.command);
    } else {
      console.log("\n❌ MCP server configuration is incorrect!");
    }
  } catch (error) {
    console.error("\n❌ Failed to read .mcp.json:", error);
  }
  
  // Clean up
  await manager.removeAgent(agent.id);
  console.log("\n🧹 Cleaned up test agent");
}

testMcpFlow().catch(console.error);