# Claude Agent SDK for Deno

A powerful Deno library for running Claude agents with sandboxing, streaming support, and Hypha integration. Built on the new **Claude Agent SDK**.

## ✨ Version 2.0 - Major Update

This library has been upgraded to use the new **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`), which provides enhanced capabilities for building AI agents. See [MIGRATION.md](./MIGRATION.md) for migration details.

## Features

- 🔒 **Sandboxing**: Uses Deno's subprocess API for permission enforcement
- 🔄 **Streaming Responses**: Real-time streaming of agent responses
- 📁 **Isolated Execution**: Each agent runs in its own working directory
- 🎯 **Session Management**: Multi-turn conversations with context preservation
- 🛠️ **Tool Support**: Full support for Claude's tool capabilities
- 🔐 **Permission Control**: Configurable permission modes (default, acceptEdits, bypassPermissions, plan)
- 🤖 **Programmatic Subagents**: Define specialized subagents for task delegation
- 🎨 **Custom System Prompts**: Tailor agent behavior with custom or preset prompts
- 📚 **Setting Sources Control**: Choose which filesystem settings to load
- 🌐 **Hypha Integration**: Expose agents as distributed services
- 🔌 **MCP Integration**: Connect to Model Context Protocol servers
- 🎛️ **Model Selection**: Specify models and fallback options

## Installation

### Prerequisites

1. Install [Deno](https://deno.land/)
2. Install Claude Agent SDK:
   ```bash
   npm install -g @anthropic-ai/claude-agent-sdk
   ```
3. Set up your Anthropic API key:
   ```bash
   export ANTHROPIC_API_KEY=your-key-here
   ```

### Import

```typescript
import { AgentManager } from "https://deno.land/x/claude_agent/mod.ts";
// Or from local file
import { AgentManager } from "./src/mod.ts";
```

## Quick Start

```typescript
import { AgentManager } from "./src/mod.ts";

// Create manager
const manager = new AgentManager("./workspace");
await manager.initialize();

// Create agent
const agent = await manager.createAgent({
  permissionMode: "default",
});

// Send command and stream responses
for await (const response of manager.sendCommand(agent.id, "Hello!")) {
  if (response.type === "agent") {
    const data = response.data;
    // Handle response
  }
}

// Clean up
await manager.removeAgent(agent.id);
```

## New in v2.0: Advanced Features

### Programmatic Subagents

Define specialized subagents for task delegation:

```typescript
const agent = await manager.createAgent({
  name: "MainAgent",
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer",
      prompt: "You are an expert code reviewer. Focus on quality and best practices.",
      tools: ["Read", "Grep", "Glob"],
      model: "sonnet"
    }
  }
});
```

### Custom System Prompts

Tailor agent behavior with custom prompts or use Claude Code's preset:

```typescript
// Custom prompt
const agent = await manager.createAgent({
  systemPrompt: "You are a data analysis expert"
});

// Claude Code preset (for coding tasks)
const codingAgent = await manager.createAgent({
  systemPrompt: { type: "preset", preset: "claude_code" }
});
```

### Setting Sources Control

Control which filesystem settings to load:

```typescript
const agent = await manager.createAgent({
  // Load project settings (CLAUDE.md, .claude/settings.json)
  settingSources: ["project"],
  // Required to interpret CLAUDE.md
  systemPrompt: { type: "preset", preset: "claude_code" }
});
```

### Model Selection

Specify models and fallbacks:

```typescript
const agent = await manager.createAgent({
  model: "claude-sonnet-4-5-20250929",
  fallbackModel: "claude-sonnet-3-5-20241022",
  maxThinkingTokens: 10000
});
```

## Examples

### Basic Usage

```bash
deno task example:basic
```

See [`examples/basic.ts`](examples/basic.ts) for a simple example.

### Advanced SDK Features

```bash
deno run --allow-all examples/advanced-sdk-features.ts
```

See [`examples/advanced-sdk-features.ts`](examples/advanced-sdk-features.ts) for comprehensive examples of:
- Programmatic subagents
- Custom system prompts
- Setting sources control
- Model selection
- Enhanced tool control

### Streaming Responses

```bash
deno task example:streaming
```

See [`examples/streaming.ts`](examples/streaming.ts) for streaming and multi-turn conversations.

### Sandboxed Execution

```bash
deno task example:sandboxed
```

See [`examples/sandboxed.ts`](examples/sandboxed.ts) for secure, sandboxed execution.

### MCP Server Integration

```bash
# Basic MCP server example
deno task example:mcp

# Advanced MCP configuration
deno task example:mcp-advanced
```

See [`examples/mcp-server.ts`](examples/mcp-server.ts) and [`examples/mcp-advanced.ts`](examples/mcp-advanced.ts) for MCP (Model Context Protocol) server integration.

## Security

This implementation uses Deno's subprocess API to spawn Claude directly, ensuring that Deno's permission system is properly enforced. The Claude process inherits Deno's restricted permissions.

### Running with Restricted Permissions

```bash
deno run \
  --allow-net \                           # For API calls
  --allow-run=claude \                    # Only allow running claude
  --allow-env \                            # For environment variables
  --allow-read=./workspace,~/Library/Caches/deno \  # Specific read paths
  --allow-write=./workspace \              # Specific write path
  your-script.ts
```

### Permission Modes

- `default`: Standard mode with permission prompts
- `acceptEdits`: Automatically accepts tool edits
- `bypassPermissions`: Bypasses all permission checks (no tools executed)
- `plan`: Planning mode for complex tasks

## MCP Server Support

MCP (Model Context Protocol) servers extend Claude's capabilities by providing additional tools, data sources, and integrations. This library supports connecting Claude to MCP servers via HTTP transport.

### Using MCP Servers

```typescript
// Configure default MCP servers for all agents
const manager = new AgentManager({
  baseDirectory: "./agent-workspaces",
  defaultMcpServers: [
    {
      name: "shared-mcp",
      url: "https://example.com/mcp",
      transport: "http"
    }
  ]
});

// Create agent with additional MCP servers
const agent = await manager.createAgent({
  permissionMode: "default",
  mcpServers: [
    {
      name: "agent-specific",
      url: "https://another.com/mcp",
      transport: "http"
    }
  ]
});

// Agent now has access to both default and agent-specific MCP servers
for await (const response of manager.sendCommand(
  agent.id,
  "List available MCP servers and their capabilities"
)) {
  // Handle responses
}
```

### MCP Server Features

- **Additional Tools**: MCP servers can provide custom tools beyond Claude's built-in capabilities
- **Data Sources**: Access external databases, APIs, or file systems through MCP
- **Integrations**: Connect to third-party services and platforms
- **Custom Processing**: Perform specialized computations or transformations

## API Reference

### AgentManager

```typescript
class AgentManager {
  constructor(config?: ManagerConfig | string)
  async initialize(): Promise<void>
  async createAgent(options?: CreateAgentOptions): Promise<Agent>
  getAgent(id: string): Agent | undefined
  getAllAgents(): Agent[]
  async *sendCommand(agentId: string, prompt: string, sessionId?: string): AsyncGenerator<StreamResponse>
  stopAgent(id: string): boolean
  async removeAgent(id: string, keepDirectory?: boolean): Promise<boolean>
  async removeAllAgents(keepDirectories?: boolean): Promise<number>
  async cleanup(): Promise<void>
  getInfo(): ManagerInfo
}

interface ManagerConfig {
  baseDirectory?: string
  defaultMcpServers?: MCPServerConfig[]
  settingsTemplatePath?: string
}
```

### Agent

```typescript
class Agent {
  readonly id: string
  readonly workingDirectory: string
  async *execute(prompt: string, sessionId?: string): AsyncGenerator<StreamResponse>
  abort(): void
  getInfo(): AgentInfo
  static async verifyClaudeInstallation(claudePath?: string): Promise<boolean>
}
```

### Types

```typescript
type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan"

interface CreateAgentOptions {
  workingDirectory?: string
  permissionMode?: PermissionMode
  allowedTools?: string[]
  claudePath?: string
}

interface StreamResponse {
  type: "agent" | "error" | "done" | "aborted"
  data?: unknown
  error?: string
}
```

## Testing

Run all tests:
```bash
deno task test
```

Run specific tests:
```bash
deno task test:agent
deno task test:manager
```

## Development

### Project Structure

```
├── src/                 # Source code
│   ├── agent.ts        # Agent implementation
│   ├── manager.ts      # Manager implementation
│   ├── types.ts        # Type definitions
│   └── mod.ts          # Main exports
├── tests/              # Test files
│   ├── agent_test.ts   # Agent tests
│   └── manager_test.ts # Manager tests
├── examples/           # Example scripts
│   ├── basic.ts        # Basic usage
│   ├── streaming.ts    # Streaming example
│   └── sandboxed.ts    # Sandboxed execution
├── deno.json           # Deno configuration
└── README.md           # Documentation
```

### Available Tasks

```bash
deno task test              # Run all tests
deno task test:agent        # Test agent
deno task test:manager      # Test manager
deno task example:basic     # Run basic example
deno task example:streaming # Run streaming example
deno task example:sandboxed # Run sandboxed example
deno task fmt               # Format code
deno task lint              # Lint code
deno task check             # Type check
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.