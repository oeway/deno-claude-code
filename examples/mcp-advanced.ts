#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read --allow-write

/**
 * Advanced MCP Server Example
 * Shows multiple MCP servers and advanced configuration options
 *
 * MCP (Model Context Protocol) servers extend Claude's capabilities by providing
 * additional tools, data sources, and integrations via settings.json configuration.
 */

import { AgentManager } from "../src/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

async function advancedMCPExample() {
  console.log("🚀 Advanced MCP Server Integration\n");
  console.log("=".repeat(50));

  const workingDirectory = "./mcp-advanced-workspace";

  console.log("📡 MCP Server Configuration:");
  console.log(
    `   Primary: https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp`,
  );
  console.log(`   Transport: HTTP`);
  console.log(`   Working Dir: ${workingDirectory}`);
  console.log(`   Method: Settings.json configuration\n`);

  try {
    // Initialize manager
    const manager = new AgentManager(workingDirectory);
    await manager.initialize();
    console.log(`✅ Claude Code SDK verified\n`);

    // Create working directory
    await ensureDir(workingDirectory);

    // Example 1: Agent with single MCP server
    console.log("📝 Example 1: Single MCP Server Configuration");
    console.log("-".repeat(40));

    const agent1 = await manager.createAgent({
      workingDirectory: `${workingDirectory}/agent1`,
      permissionMode: "default",
      mcpServers: [{
        name: "hypha-primary",
        url: "https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp",
        transport: "http",
      }],
    });

    console.log(`✅ Agent 1 created: ${agent1.id}`);
    console.log(`📁 Working directory: ${agent1.workingDirectory}`);
    console.log(`📄 Settings.json created with MCP server\n`);

    // Query the MCP server
    console.log("Querying MCP server capabilities...\n");

    for await (
      const response of manager.sendCommand(
        agent1.id,
        "List all available tools from the hypha-primary MCP server",
      )
    ) {
      if (response.type === "agent") {
        const data = response.data as any;

        if (data.type === "system") {
          console.log(`⚙️  System: MCP servers loaded`);
          if (data.mcp_servers) {
            console.log(
              `   Available servers: ${JSON.stringify(data.mcp_servers)}`,
            );
          }
        } else if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                const text = item.text;
                // Limit output for readability
                if (text.length > 500) {
                  console.log("💬", text.substring(0, 500) + "...");
                } else {
                  console.log("💬", text);
                }
              } else if (item.type === "tool_use") {
                console.log(`\n🔧 MCP Tool: ${item.name}`);
                console.log(`   Server: hypha-primary`);
              }
            }
          }
        } else if (data.type === "mcp_server_response") {
          console.log("📊 MCP Server Response received");
        }
      } else if (response.type === "done") {
        console.log("\n✅ Command completed");
      } else if (response.type === "error") {
        console.error(`❌ Error: ${response.error}`);
      }
    }

    // Example 2: Agent with multiple MCP servers
    console.log("\n📝 Example 2: Multiple MCP Servers");
    console.log("-".repeat(40));

    const agent2 = await manager.createAgent({
      workingDirectory: `${workingDirectory}/agent2`,
      permissionMode: "default",
      mcpServers: [
        {
          name: "hypha-main",
          url: "https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp",
          transport: "http",
        },
        {
          name: "local-tools",
          url: "http://localhost:8080/mcp",
          transport: "http",
        },
      ],
    });

    console.log(`✅ Agent 2 created: ${agent2.id}`);
    console.log(`📁 Working directory: ${agent2.workingDirectory}`);
    console.log(`📄 Settings.json created with multiple MCP servers\n`);

    // Show the generated settings for agent 2
    console.log("Generated settings.json for Agent 2:");
    try {
      const settingsPath = `${agent2.workingDirectory}/settings.json`;
      const settings = await Deno.readTextFile(settingsPath);
      console.log(settings);
    } catch (error) {
      console.log("Could not read settings.json");
    }

    // Example 3: Using MCP tools in practice
    console.log("\n📝 Example 3: Practical MCP Usage");
    console.log("-".repeat(40));

    const practicalQueries = [
      "Use the MCP server to fetch some data or perform a calculation",
      "What are the most useful functions this MCP server provides for data processing?",
    ];

    for (const query of practicalQueries) {
      console.log(`\n👤 Query: ${query}\n`);

      for await (const response of manager.sendCommand(agent1.id, query)) {
        if (response.type === "agent") {
          const data = response.data as any;

          if (data.type === "assistant") {
            const content = data.message?.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === "text") {
                  const text = item.text;
                  // Limit output for readability
                  if (text.length > 400) {
                    console.log("🤖", text.substring(0, 400) + "...");
                  } else {
                    console.log("🤖", text);
                  }
                } else if (item.type === "tool_use") {
                  console.log(`🔧 Calling MCP function: ${item.name}`);
                }
              }
            }
          } else if (data.type === "tool_result") {
            console.log("📊 Tool executed successfully");
          }
        }
      }
    }

    // Example 4: Custom settings template
    console.log("\n📝 Example 4: Custom Settings Template");
    console.log("-".repeat(40));

    // Create a custom settings file directly
    const customSettings = {
      mcpServers: {
        "hypha-custom": {
          command: "http",
          url: "https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp",
          transport: "http",
          headers: {
            "Authorization": "Bearer optional-token",
          },
        },
      },
      defaultPermissionMode: "acceptEdits",
      logLevel: "debug",
      customConfig: {
        timeout: 30000,
        retries: 3,
      },
    };

    const agent3WorkDir = `${workingDirectory}/agent3`;
    await ensureDir(agent3WorkDir);
    await Deno.writeTextFile(
      `${agent3WorkDir}/settings.json`,
      JSON.stringify(customSettings, null, 2),
    );

    const agent3 = await manager.createAgent({
      workingDirectory: agent3WorkDir,
      permissionMode: "acceptEdits",
    });

    console.log(`✅ Agent 3 created with custom settings`);
    console.log(`📁 Working directory: ${agent3.workingDirectory}`);
    console.log(`📄 Custom settings.json applied\n`);

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent1.id, true); // Keep directory for inspection
    await manager.removeAgent(agent2.id, true);
    await manager.removeAgent(agent3.id, true);

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║              Advanced MCP Integration Complete               ║
║                                                              ║
║  This example demonstrated:                                 ║
║  ✅ Settings.json based MCP configuration                   ║
║  ✅ Single MCP server setup                                 ║
║  ✅ Multiple MCP servers configuration                      ║
║  ✅ Custom settings templates                               ║
║  ✅ MCP tool discovery and usage                            ║
║                                                              ║
║  Configuration Method:                                      ║
║  • Settings.json in each agent's working directory          ║
║  • Supports multiple MCP servers per agent                  ║
║  • Custom configuration options available                   ║
║                                                              ║
║  MCP servers can provide:                                   ║
║  • Additional tools and functions                           ║
║  • External data sources                                    ║
║  • API integrations                                         ║
║  • Custom processing capabilities                           ║
║                                                              ║
║  Settings files preserved in: ${workingDirectory}    ║
╚══════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("\nTroubleshooting:");
    console.error("1. Ensure Claude Code SDK is installed");
    console.error("2. Check if the MCP server URL is accessible");
    console.error("3. Verify settings.json format is correct");
    console.error("4. Check network connectivity to MCP servers");
  }
}

// Run the example
if (import.meta.main) {
  advancedMCPExample();
}
