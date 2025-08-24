import { AgentManager } from "../../../src/mod.ts";

// Create a single shared instance of AgentManager
export const manager = new AgentManager({
  baseDirectory: "./agent-workspaces",
  defaultMcpServers: []
});

// Initialize the manager
await manager.initialize();