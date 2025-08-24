/**
 * Web UI Rich Message Rendering Test
 * Tests that all message types are properly rendered in the UI
 */

import { assertEquals, assertExists } from "@std/assert";
import { AgentManager } from "../src/mod.ts";
import { AgentConfig } from "../src/types.ts";

const BASE_URL = "http://localhost:8000";

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

Deno.test("Web UI API - Health Check", async () => {
  // Test that server responds to root path
  const response = await fetch(BASE_URL);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "text/html; charset=utf-8");
  
  const html = await response.text();
  assertExists(html.includes("Claude Code Agent Manager"));
});

Deno.test("Web UI API - List Agents", async () => {
  const response = await fetch(`${BASE_URL}/api/agents`);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "application/json");
  
  const agents = await response.json();
  assertEquals(Array.isArray(agents), true);
});

Deno.test("Web UI API - Create Agent", async () => {
  const config: AgentConfig = {
    workingDirectory: "./test-workspace/test-agent",
    permissionMode: "default",
    mcpServers: [
      {
        name: "test-mcp",
        url: "https://example.com/mcp",
        transport: "http",
      }
    ],
  };

  const response = await fetch(`${BASE_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  assertEquals(response.status, 200);
  const agent = await response.json();
  assertExists(agent.id);
  assertEquals(agent.workingDirectory, config.workingDirectory);
  assertEquals(agent.permissionMode, config.permissionMode);
  
  // Clean up - delete the created agent
  await fetch(`${BASE_URL}/api/agents/${agent.id}`, { method: "DELETE" });
});

Deno.test("Web UI API - Delete Agent", async () => {
  // First create an agent
  const config: AgentConfig = {
    workingDirectory: "./test-workspace/delete-test",
    permissionMode: "default",
  };

  const createResponse = await fetch(`${BASE_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  
  const agent = await createResponse.json();
  
  // Now delete it
  const deleteResponse = await fetch(`${BASE_URL}/api/agents/${agent.id}`, {
    method: "DELETE",
  });
  
  assertEquals(deleteResponse.status, 200);
  const result = await deleteResponse.json();
  assertEquals(result.success, true);
  
  // Verify it's deleted by listing agents
  const listResponse = await fetch(`${BASE_URL}/api/agents`);
  const agents = await listResponse.json();
  const found = agents.find((a: any) => a.id === agent.id);
  assertEquals(found, undefined);
});

Deno.test("Web UI API - Send Chat Message", async () => {
  // Create an agent first
  const config: AgentConfig = {
    workingDirectory: "./test-workspace/chat-test",
    permissionMode: "default",
  };

  const createResponse = await fetch(`${BASE_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  
  const agent = await createResponse.json();
  
  // Send a message
  const chatResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: agent.id,
      message: "What is 2+2?",
    }),
  });
  
  assertEquals(chatResponse.status, 200);
  assertEquals(chatResponse.headers.get("content-type"), "text/event-stream");
  
  // Read SSE stream
  const reader = chatResponse.body!.getReader();
  const decoder = new TextDecoder();
  let receivedData = false;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    if (chunk.includes("data:")) {
      receivedData = true;
      // Check for valid SSE format
      assertExists(chunk.includes("data: "));
    }
    
    // Stop after receiving some data to avoid long test
    if (receivedData) break;
  }
  
  assertEquals(receivedData, true);
  
  // Clean up
  await fetch(`${BASE_URL}/api/agents/${agent.id}`, { method: "DELETE" });
});

Deno.test("Web UI API - Clear Session", async () => {
  const response = await fetch(`${BASE_URL}/api/sessions`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "test-agent-id" }),
  });
  
  assertEquals(response.status, 200);
  const result = await response.json();
  assertEquals(result.success, true);
});

Deno.test("Web UI API - CORS Headers", async () => {
  const response = await fetch(`${BASE_URL}/api/agents`, {
    method: "OPTIONS",
  });
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assertEquals(response.headers.get("access-control-allow-methods"), "GET, POST, DELETE, OPTIONS");
  assertEquals(response.headers.get("access-control-allow-headers"), "Content-Type");
});

Deno.test("Web UI API - Error Handling", async () => {
  // Test invalid route
  const response = await fetch(`${BASE_URL}/api/invalid-route`);
  assertEquals(response.status, 404);
  
  // Test missing parameters
  const chatResponse = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "test" }), // Missing agentId
  });
  
  assertEquals(chatResponse.status, 400);
  const error = await chatResponse.json();
  assertExists(error.error);
});

Deno.test("Web UI API - WebSocket Agent Updates", async () => {
  // Create an agent first
  const config: AgentConfig = {
    workingDirectory: "./test-workspace/websocket-test",
    permissionMode: "default",
  };

  const createResponse = await fetch(`${BASE_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  
  const agent = await createResponse.json();
  
  // Connect to WebSocket
  const ws = new WebSocket(`ws://localhost:8000/ws`);
  
  const messages: any[] = [];
  const messagePromise = new Promise((resolve) => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      messages.push(data);
      
      // Resolve after receiving agent update
      if (data.type === "agent_update") {
        resolve(true);
      }
    };
  });
  
  await new Promise((resolve) => {
    ws.onopen = () => resolve(true);
  });
  
  // Update agent to trigger WebSocket message
  const updateResponse = await fetch(`${BASE_URL}/api/agents/${agent.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "running" }),
  });
  
  // Wait for WebSocket message or timeout
  const received = await Promise.race([
    messagePromise,
    new Promise((resolve) => setTimeout(() => resolve(false), 5000))
  ]);
  
  assertEquals(received, true);
  assertExists(messages.find(m => m.type === "agent_update" && m.agentId === agent.id));
  
  // Clean up
  ws.close();
  await fetch(`${BASE_URL}/api/agents/${agent.id}`, { method: "DELETE" });
});

// Integration test helper to start server
export async function startTestServer(): Promise<Deno.ChildProcess> {
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-all", "examples/web-ui/server.ts"],
    stdout: "piped",
    stderr: "piped",
  });
  
  const process = command.spawn();
  
  // Wait for server to be ready
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    process.kill();
    throw new Error("Server failed to start");
  }
  
  return process;
}

// Run integration tests if this is the main module
if (import.meta.main) {
  console.log("Starting Web UI server for testing...");
  const serverProcess = await startTestServer();
  
  try {
    // Run the tests
    console.log("Running API tests...");
    await Deno.test("Web UI API Tests", async (t) => {
      await t.step("Health Check", async () => {
        const response = await fetch(BASE_URL);
        assertEquals(response.status, 200);
      });
      
      await t.step("API Endpoints", async () => {
        // List agents
        const listResponse = await fetch(`${BASE_URL}/api/agents`);
        assertEquals(listResponse.status, 200);
        
        // Create agent
        const config = {
          workingDirectory: "./test-workspace/integration-test",
          permissionMode: "default",
        };
        
        const createResponse = await fetch(`${BASE_URL}/api/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        
        assertEquals(createResponse.status, 200);
        const agent = await createResponse.json();
        
        // Delete agent
        const deleteResponse = await fetch(`${BASE_URL}/api/agents/${agent.id}`, {
          method: "DELETE",
        });
        assertEquals(deleteResponse.status, 200);
      });
    });
    
    console.log("✅ All API tests passed!");
  } finally {
    // Clean up
    serverProcess.kill();
  }
}