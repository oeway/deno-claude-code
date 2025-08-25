#!/usr/bin/env -S deno run --allow-all

import { query } from "npm:@anthropic-ai/claude-code@1.0.89";

async function testDynamicMcp() {
  console.log("Testing dynamic MCP configuration...\n");
  
  const abortController = new AbortController();
  
  // Test if we can pass MCP servers directly
  const options = {
    abortController,
    cwd: "/tmp",
    // Try various possible option names
    mcpServers: {
      "filesystem": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: {
          "ALLOWED_DIRECTORIES": "/tmp"
        }
      }
    },
    // Also try as array format
    mcp: [
      {
        name: "filesystem",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: {
          "ALLOWED_DIRECTORIES": "/tmp"
        }
      }
    ]
  };
  
  console.log("Testing with options:", JSON.stringify(options, null, 2));
  
  try {
    // Try to execute a simple query
    for await (const message of query({
      prompt: "What MCP servers are available?",
      options: options as any
    })) {
      console.log("Message type:", message.type);
      if (message.type === "system" && message.subtype === "init") {
        console.log("Available tools:", message.tools);
        console.log("MCP info:", (message as any).mcp || "No MCP info");
      }
      // Just get first few messages to test
      break;
    }
  } catch (error) {
    console.error("Error:", error);
  }
  
  abortController.abort();
}

testDynamicMcp().catch(console.error);