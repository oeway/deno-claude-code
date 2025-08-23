#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read --allow-write

/**
 * Default MCP Servers Example
 * Demonstrates how to configure default MCP servers for all agents,
 * plus additional per-agent MCP servers
 */

import { AgentManager } from "../src/mod.ts";
import type { MCPServerConfig } from "../src/mod.ts";

async function defaultMcpServersExample() {
  console.log("🌐 Default MCP Servers Example\n");
  console.log("=".repeat(50));

  // Define default MCP servers that all agents will have
  const defaultMcpServers: MCPServerConfig[] = [
    {
      name: "hypha-global",
      url: "https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp",
      transport: "http",
    },
    {
      name: "shared-tools",
      url: "http://localhost:8080/shared-mcp",
      transport: "http",
    },
  ];

  console.log("📡 Default MCP Servers (for all agents):");
  for (const server of defaultMcpServers) {
    console.log(`   - ${server.name}: ${server.url}`);
  }
  console.log();

  // Create manager with default MCP servers
  const manager = new AgentManager({
    baseDirectory: "./agent-workspaces",
    defaultMcpServers: defaultMcpServers,
  });

  try {
    await manager.initialize();
    console.log("✅ Manager initialized with default MCP servers\n");

    // Example 1: Agent with only default servers
    console.log("📝 Example 1: Agent with Default Servers Only");
    console.log("-".repeat(40));

    const agent1 = await manager.createAgent({
      workingDirectory: "./mcp-default-workspace/agent1",
      permissionMode: "default",
      // No additional MCP servers - will use only defaults
    });

    console.log(`🤖 Agent 1 created: ${agent1.id}`);
    console.log(`📁 Working directory: ${agent1.workingDirectory}`);
    console.log(`📄 Settings.json created with default MCP servers\n`);

    // Show settings for agent 1
    try {
      const settings1 = await Deno.readTextFile(
        `${agent1.workingDirectory}/settings.json`,
      );
      const parsed1 = JSON.parse(settings1);
      console.log("Agent 1 MCP Servers:");
      for (const [name, config] of Object.entries(parsed1.mcpServers)) {
        console.log(`   - ${name}: ${(config as any).url}`);
      }
    } catch (error) {
      console.log("Could not read settings.json");
    }

    // Example 2: Agent with additional servers
    console.log("\n📝 Example 2: Agent with Default + Additional Servers");
    console.log("-".repeat(40));

    const agent2 = await manager.createAgent({
      workingDirectory: "./mcp-default-workspace/agent2",
      permissionMode: "default",
      mcpServers: [
        {
          name: "agent2-special",
          url: "http://localhost:9090/agent2-mcp",
          transport: "http",
        },
      ],
    });

    console.log(`🤖 Agent 2 created: ${agent2.id}`);
    console.log(`📁 Working directory: ${agent2.workingDirectory}`);
    console.log(`📄 Settings.json created with default + additional servers\n`);

    // Show settings for agent 2
    try {
      const settings2 = await Deno.readTextFile(
        `${agent2.workingDirectory}/settings.json`,
      );
      const parsed2 = JSON.parse(settings2);
      console.log("Agent 2 MCP Servers:");
      for (const [name, config] of Object.entries(parsed2.mcpServers)) {
        console.log(`   - ${name}: ${(config as any).url}`);
      }
    } catch (error) {
      console.log("Could not read settings.json");
    }

    // Example 3: Agent that overrides a default server
    console.log("\n📝 Example 3: Agent Overriding a Default Server");
    console.log("-".repeat(40));

    const agent3 = await manager.createAgent({
      workingDirectory: "./mcp-default-workspace/agent3",
      permissionMode: "default",
      mcpServers: [
        {
          // Override the shared-tools server with a different URL
          name: "shared-tools",
          url: "http://localhost:9999/custom-shared-tools",
          transport: "http",
        },
        {
          // Add an agent-specific server
          name: "agent3-custom",
          url: "http://localhost:7777/agent3-mcp",
          transport: "http",
        },
      ],
    });

    console.log(`🤖 Agent 3 created: ${agent3.id}`);
    console.log(`📁 Working directory: ${agent3.workingDirectory}`);
    console.log(
      `📄 Settings.json created with overridden default + additional servers\n`,
    );

    // Show settings for agent 3
    try {
      const settings3 = await Deno.readTextFile(
        `${agent3.workingDirectory}/settings.json`,
      );
      const parsed3 = JSON.parse(settings3);
      console.log("Agent 3 MCP Servers:");
      for (const [name, config] of Object.entries(parsed3.mcpServers)) {
        const url = (config as any).url;
        if (name === "shared-tools") {
          console.log(`   - ${name}: ${url} (overridden)`);
        } else {
          console.log(`   - ${name}: ${url}`);
        }
      }
    } catch (error) {
      console.log("Could not read settings.json");
    }

    // Example 4: Query agents to demonstrate they have access to their MCP servers
    console.log("\n📝 Example 4: Testing MCP Server Access");
    console.log("-".repeat(40));

    console.log("\nAgent 1 (default servers only):");
    for await (
      const response of manager.sendCommand(
        agent1.id,
        "List the MCP servers available to you",
      )
    ) {
      if (response.type === "claude_json") {
        const data = response.data as any;
        if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                const text = item.text;
                if (text.length > 200) {
                  console.log("💬", text.substring(0, 200) + "...");
                } else {
                  console.log("💬", text);
                }
              }
            }
          }
        }
      } else if (response.type === "done") {
        break;
      }
    }

    // Get manager info
    console.log("\n📊 Manager Information:");
    console.log("-".repeat(40));
    const info = manager.getInfo();
    console.log(`Base Directory: ${info.baseDirectory}`);
    console.log(`Active Agents: ${info.agentCount}`);
    console.log(`Default MCP Servers: ${info.defaultMcpServers?.length || 0}`);
    if (info.defaultMcpServers) {
      for (const server of info.defaultMcpServers) {
        console.log(`   - ${server.name}: ${server.url}`);
      }
    }

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent1.id, true); // Keep directories for inspection
    await manager.removeAgent(agent2.id, true);
    await manager.removeAgent(agent3.id, true);

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║             Default MCP Servers Example Complete             ║
║                                                              ║
║  This example demonstrated:                                 ║
║  ✅ Manager with default MCP servers                        ║
║  ✅ Agents inheriting default servers                       ║
║  ✅ Agents adding additional servers                        ║
║  ✅ Agents overriding default servers                       ║
║                                                              ║
║  Key Features:                                              ║
║  • Default servers apply to all agents                      ║
║  • Each agent can add its own servers                       ║
║  • Agents can override defaults by name                     ║
║  • Settings.json created per agent                          ║
║                                                              ║
║  Settings preserved in: ./mcp-default-workspace             ║
╚══════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("\nTroubleshooting:");
    console.error("1. Ensure Claude Code SDK is installed");
    console.error("2. Check MCP server URLs are valid");
    console.error("3. Verify settings.json format");
  }
}

// Run the example
if (import.meta.main) {
  defaultMcpServersExample();
}
