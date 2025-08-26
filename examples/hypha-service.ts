/**
 * Example: Using Claude Agent Manager via Hypha Service
 * 
 * This example demonstrates how to connect to the Claude Agent Manager
 * service running on Hypha and interact with agents through streaming.
 */

import { hyphaWebsocketClient } from "npm:hypha-rpc";

// Configuration
const HYPHA_SERVER_URL = "https://hypha.aicell.io";
const SERVICE_ID = "claude-agent-manager";

interface StreamUpdate {
  type: "stream" | "permission" | "error" | "done" | "aborted";
  data?: any;
  error?: string;
  permissionRequest?: any;
  timestamp: number;
}

/**
 * Example client that connects to the Claude Agent Manager service
 */
class ClaudeAgentClient {
  private server: any;
  private service: any;
  private agentId?: string;
  private sessionId?: string;

  async connect(workspace?: string): Promise<void> {
    // Connect to Hypha server
    const config: any = { server_url: HYPHA_SERVER_URL };
    if (workspace) {
      config.workspace = workspace;
    }
    config.token = await hyphaWebsocketClient.login({ server_url: HYPHA_SERVER_URL }); 
    this.server = await hyphaWebsocketClient.connectToServer(config);
    console.log(`✅ Connected to Hypha server`);
    console.log(`📁 Workspace: ${this.server.config.workspace}`);

    // Get the service
    const servicePath = workspace 
      ? `${workspace}/${SERVICE_ID}` 
      : SERVICE_ID;
    
    try {
      this.service = await this.server.getService(servicePath);
      console.log(`✅ Connected to Claude Agent Manager service`);
    } catch (error) {
      console.error(`❌ Failed to connect to service: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(name?: string): Promise<void> {
    const agentInfo = await this.service.createAgent({
      name: name || `Agent-${Date.now()}`,
      description: "Example agent created via Hypha",
      permissionMode: "default",
    });

    this.agentId = agentInfo.id;
    this.sessionId = `session-${Date.now()}`;
    
    console.log(`✅ Created agent: ${agentInfo.id}`);
    console.log(`   Name: ${agentInfo.name}`);
    console.log(`   Working Directory: ${agentInfo.workingDirectory}`);
  }

  /**
   * Execute a command with streaming and permission handling
   */
  async executeCommand(prompt: string, autoApprove = false): Promise<void> {
    if (!this.agentId) {
      throw new Error("No agent created. Call createAgent() first.");
    }

    console.log(`\n📝 Executing: "${prompt}"`);
    console.log("━".repeat(50));

    try {
      // Get the async generator for streaming execution
      const generator = await this.service.executeStreaming({
        agentId: this.agentId,
        prompt: prompt,
        sessionId: this.sessionId,
      });

      // Process the stream
      for await (const update of generator) {
        await this.handleStreamUpdate(update, autoApprove);
      }
    } catch (error) {
      console.error(`❌ Execution error: ${error}`);
    }
  }

  /**
   * Handle stream updates
   */
  private async handleStreamUpdate(update: StreamUpdate, autoApprove: boolean): Promise<void> {
    switch (update.type) {
      case "stream":
        // Handle regular streaming data
        if (update.data) {
          this.displayAgentResponse(update.data);
        }
        break;

      case "permission":
        // Handle permission request
        console.log(`\n⚠️  Permission Request:`);
        console.log(`   Tool: ${update.permissionRequest.toolName}`);
        console.log(`   Description: ${update.permissionRequest.description || "N/A"}`);
        console.log(`   Patterns: ${update.permissionRequest.patterns.join(", ")}`);

        // Auto-approve or prompt for user input
        const action = autoApprove ? "allow" : await this.promptForPermission();
        
        const response = {
          requestId: update.permissionRequest.id,
          action: action,
        };

        await this.service.respondToPermission(response);
        console.log(`   ➡️  Response: ${action}`);
        break;

      case "error":
        console.error(`\n❌ Error: ${update.error}`);
        break;

      case "done":
        console.log(`\n✅ Execution completed`);
        break;

      case "aborted":
        console.log(`\n⚠️  Execution aborted`);
        break;
    }
  }

  /**
   * Display agent response based on type
   */
  private displayAgentResponse(data: any): void {
    if (!data) return;

    // Handle different message types from Claude
    if (data.type === "agent" && data.data) {
      const msg = data.data;
      
      if (msg.type === "system") {
        // System messages (initialization, etc.)
        if (msg.cwd) {
          console.log(`📁 Working directory: ${msg.cwd}`);
        }
      } else if (msg.type === "assistant") {
        // Assistant messages (actual responses)
        if (msg.message?.content) {
          for (const item of msg.message.content) {
            if (item.type === "text" && item.text) {
              console.log(item.text);
            } else if (item.type === "tool_use") {
              console.log(`🔧 Using tool: ${item.name}`);
            }
          }
        }
      } else if (msg.type === "result") {
        // Result messages (completion status)
        if (msg.subtype === "success") {
          console.log(`\n📊 Usage: ${msg.usage?.inputTokens || 0} input, ${msg.usage?.outputTokens || 0} output tokens`);
        }
      }
    }
  }

  /**
   * Prompt user for permission decision
   */
  private async promptForPermission(): Promise<string> {
    console.log(`\n   [a]llow / [p]ermanent / [d]eny? `);
    
    // For demonstration, we'll auto-deny after a timeout
    // In a real application, you'd read from stdin or UI
    console.log(`   (Auto-denying in 5 seconds...)`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    return "deny";
  }

  /**
   * Get service information
   */
  async getInfo(): Promise<void> {
    const info = await this.service.getInfo();
    console.log("\n📊 Manager Information:");
    console.log(`   Base Directory: ${info.baseDirectory}`);
    console.log(`   Active Agents: ${info.agentCount}`);
    console.log(`   Verified: ${info.verified}`);
    
    if (info.agents.length > 0) {
      console.log("\n   Active Agents:");
      for (const agent of info.agents) {
        console.log(`   - ${agent.id}: ${agent.name || "Unnamed"}`);
      }
    }
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<void> {
    const agents = await this.service.getAllAgents();
    console.log(`\n📋 Total Agents: ${agents.length}`);
    
    for (const agent of agents) {
      console.log(`\n   Agent: ${agent.id}`);
      console.log(`   - Name: ${agent.name || "Unnamed"}`);
      console.log(`   - Description: ${agent.description || "N/A"}`);
      console.log(`   - Directory: ${agent.workingDirectory}`);
      console.log(`   - Permission Mode: ${agent.permissionMode}`);
    }
  }

  /**
   * Clean up the current agent
   */
  async cleanup(): Promise<void> {
    if (this.agentId) {
      const success = await this.service.removeAgent(this.agentId);
      if (success) {
        console.log(`\n✅ Removed agent: ${this.agentId}`);
      } else {
        console.log(`\n⚠️  Failed to remove agent: ${this.agentId}`);
      }
      this.agentId = undefined;
    }
  }

  /**
   * Disconnect from the service
   */
  async disconnect(): Promise<void> {
    if (this.server) {
      await this.server.disconnect();
      console.log("👋 Disconnected from Hypha");
    }
  }
}

/**
 * Main example function
 */
async function runExample() {
  const client = new ClaudeAgentClient();
  
  console.log("═".repeat(60));
  console.log("Claude Agent Manager - Example Client");
  console.log("═".repeat(60));
  console.log("\nIMPORTANT: Make sure the service is running first!");
  console.log("Run this in another terminal: ./start-hypha-service.sh");
  console.log("\n");
  
  // Check for workspace argument
  const workspace = Deno.args[0];
  if (workspace && !workspace.startsWith("-")) {
    console.log(`Using workspace: ${workspace}`);
  } else {
    console.log("No workspace provided. Will use auto-assigned workspace.");
    console.log("To connect to a specific service, provide the workspace ID:");
    console.log("  deno run --allow-net examples/hypha-service.ts <workspace-id>");
  }
  
  try {
    // Connect to the service
    await client.connect(workspace);
    
    // Get service info
    await client.getInfo();
    
    // Create a new agent
    await client.createAgent("ExampleAgent");
    
    // Execute some commands
    console.log("\n" + "═".repeat(60));
    console.log("EXECUTING COMMANDS");
    console.log("═".repeat(60));
    
    // Example 1: Simple command (auto-approve permissions for demo)
    await client.executeCommand(
      "Create a file called hello.txt with 'Hello from Hypha!' content",
      true // auto-approve
    );
    
    // Example 2: Check the file
    await client.executeCommand(
      "Show me the contents of hello.txt",
      true
    );
    
    // Example 3: More complex task
    await client.executeCommand(
      "Create a simple Python script that prints the current time",
      true
    );
    
    // List all agents
    await client.listAgents();
    
    // Clean up
    await client.cleanup();
    
  } catch (error) {
    console.error("Error in example:", error);
  } finally {
    await client.disconnect();
  }
}

/**
 * Interactive mode for testing
 */
async function runInteractive() {
  const client = new ClaudeAgentClient();
  
  console.log("🚀 Claude Agent Manager - Interactive Client");
  console.log("=" . repeat(50));
  
  try {
    // Connect
    const workspace = prompt("Enter workspace (or press Enter for default): ");
    await client.connect(workspace || undefined);
    
    // Create agent
    const agentName = prompt("Enter agent name (or press Enter for auto): ");
    await client.createAgent(agentName || undefined);
    
    console.log("\n📝 Enter commands (type 'exit' to quit, 'info' for status)");
    
    while (true) {
      const command = prompt("\n> ");
      
      if (!command || command.toLowerCase() === "exit") {
        break;
      }
      
      if (command.toLowerCase() === "info") {
        await client.getInfo();
        continue;
      }
      
      if (command.toLowerCase() === "list") {
        await client.listAgents();
        continue;
      }
      
      // Execute the command
      const autoApprove = confirm("Auto-approve permissions? (y/n): ");
      await client.executeCommand(command, autoApprove);
    }
    
    // Clean up
    const shouldCleanup = confirm("Remove agent? (y/n): ");
    if (shouldCleanup) {
      await client.cleanup();
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.disconnect();
  }
}

// Run the example
if (import.meta.main) {
  // Check for command line arguments
  const args = Deno.args;
  
  if (args.includes("--interactive") || args.includes("-i")) {
    await runInteractive();
  } else {
    await runExample();
  }
}