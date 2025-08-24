#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --allow-read --allow-write

/**
 * MCP Server Example
 * Demonstrates connecting to an MCP (Model Context Protocol) server
 *
 * This example shows how to use Claude with an external MCP server
 * that provides additional tools and capabilities via settings.json configuration.
 */

import { AgentManager } from "../src/mod.ts";

async function mcpServerExample() {
  console.log("🌐 MCP Server Integration Example\n");
  console.log("=".repeat(50));

  // MCP server configuration
  const mcpServerUrl =
    "https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp";
  console.log(`📡 MCP Server: ${mcpServerUrl}`);
  console.log(`🔌 Transport: HTTP`);
  console.log(`⚙️  Configuration: Via .mcp.json (workspace-based)\n`);

  const manager = new AgentManager("./agent-workspaces");

  try {
    await manager.initialize();
    console.log("✅ Claude Code SDK verified\n");

    // Create an agent with MCP server configuration
    // The settings.json will be created in the agent's working directory
    const agent = await manager.createAgent({
      workingDirectory: "./mcp-workspace/agent",
      permissionMode: "default",
      mcpServers: [{
        name: "hypha-mcp",
        url: mcpServerUrl,
        transport: "http",
      }],
    });

    console.log(`🤖 Agent created: ${agent.id}`);
    console.log(`📁 Working directory: ${agent.workingDirectory}`);
    console.log(`📄 .mcp.json created with MCP configuration\n`);

    // Example 1: Query MCP server capabilities
    console.log("📝 Example 1: Exploring MCP Server Tools");
    console.log("-".repeat(40));
    console.log("Asking Claude to list available MCP tools...\n");

    // The MCP server is now configured via settings.json
    for await (
      const response of manager.sendCommand(
        agent.id,
        `List all available tools and functions from the connected MCP server. 
       What capabilities does the hypha-mcp server provide?`,
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
                console.log(`\n🔧 Using MCP Tool: ${item.name}`);
                if (item.input) {
                  console.log(
                    "   Parameters:",
                    JSON.stringify(item.input, null, 2),
                  );
                }
              }
            }
          }
        } else if (data.type === "tool_result") {
          console.log("📊 Tool Result received");
        }
      } else if (response.type === "done") {
        console.log("\n✅ Query completed");
      } else if (response.type === "error") {
        console.error(`❌ Error: ${response.error}`);
      }
    }

    // Example 2: Use MCP server for a specific task
    console.log("\n📝 Example 2: Using MCP Server Functions");
    console.log("-".repeat(40));
    console.log("Attempting to use MCP server capabilities...\n");

    let sessionId: string | undefined;

    for await (
      const response of manager.sendCommand(
        agent.id,
        `Use the hypha-mcp server to perform a calculation or data processing task. 
       Demonstrate one of its most useful capabilities.`,
      )
    ) {
      if (response.type === "agent") {
        const data = response.data as any;

        // Capture session for continuity
        if (data.session_id && !sessionId) {
          sessionId = data.session_id;
        }

        if (data.type === "system") {
          console.log(
            `⚙️  System initialized with session: ${data.session_id}`,
          );
        } else if (data.type === "assistant") {
          const content = data.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text") {
                console.log("💬", item.text);
              } else if (item.type === "tool_use") {
                console.log(`\n🔧 MCP Tool: ${item.name}`);
                console.log("   Executing via MCP server...");
              }
            }
          }
        } else if (data.type === "tool_result") {
          const result = data as any;
          if (result.content) {
            console.log(
              "📊 MCP Result:",
              typeof result.content === "string"
                ? result.content.substring(0, 200) + "..."
                : JSON.stringify(result.content).substring(0, 200) + "...",
            );
          }
        }
      }
    }

    // Example 3: Interactive MCP usage
    console.log("\n📝 Example 3: Interactive MCP Session");
    console.log("-".repeat(40));
    console.log("Using MCP server in conversation...\n");

    const queries = [
      "What are the most powerful functions this MCP server provides?",
      "Can you use the MCP server to perform a useful calculation or fetch some data?",
    ];

    for (const query of queries) {
      console.log(`\n👤 User: ${query}`);

      for await (
        const response of manager.sendCommand(
          agent.id,
          query,
          sessionId, // Maintain session context
        )
      ) {
        if (response.type === "agent") {
          const data = response.data as any;

          if (data.type === "assistant") {
            const content = data.message?.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === "text") {
                  const text = item.text;
                  // Limit output for readability
                  if (text.length > 300) {
                    console.log("🤖 Claude:", text.substring(0, 300) + "...");
                  } else {
                    console.log("🤖 Claude:", text);
                  }
                } else if (item.type === "tool_use") {
                  console.log(`🔧 Using: ${item.name}`);
                }
              }
            }
          }
        }
      }
    }

    // Show the generated .mcp.json
    console.log("\n📄 Generated .mcp.json:");
    console.log("-".repeat(40));
    try {
      const mcpPath = `${agent.workingDirectory}/.mcp.json`;
      const mcpConfig = await Deno.readTextFile(mcpPath);
      console.log(mcpConfig);
    } catch (error) {
      console.log("Could not read .mcp.json");
    }

    // Clean up
    console.log("\n🧹 Cleaning up...");
    await manager.removeAgent(agent.id);

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  MCP Integration Summary                     ║
║                                                              ║
║  ✅ Created agent with MCP server configuration             ║
║  ✅ .mcp.json generated with MCP server details             ║
║  ✅ Explored available MCP tools                            ║
║  ✅ Demonstrated MCP server usage                           ║
║  ✅ Maintained session context                              ║
║                                                              ║
║  MCP Configuration Method:                                  ║
║  • .mcp.json in agent's working directory                   ║
║  • Server URL: ${mcpServerUrl.substring(0, 40)}...  ║
║  • Transport: HTTP                                          ║
║                                                              ║
║  Note: MCP servers extend Claude's capabilities by          ║
║  providing additional tools and data sources.               ║
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
    console.error("3. Verify .mcp.json was created correctly");
    console.error("4. Approve the MCP server when prompted by Claude Code");
  }
}

// Run the example
if (import.meta.main) {
  mcpServerExample();
}
