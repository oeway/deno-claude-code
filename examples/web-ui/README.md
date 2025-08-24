# Claude Code Agent Manager - Web UI

A rich, transparent, and responsive web interface for managing and interacting with Claude Code agents, featuring real-time streaming with detailed visual feedback for every operation.

## Features

### Rich Message Rendering
The UI provides detailed, graphical components for every message type:

- **System Initialization**: Purple-themed cards showing session details, working directory, model info, available tools, and MCP servers
- **Tool Executions**: Blue/cyan gradient cards with tool icons, expandable parameter sections, and execution results
- **Tool Results**: Color-coded success (green) and error (red) states with full output display
- **Todo Lists**: Visual status tracking with icons (⭕ pending, ⏳ in-progress, ✅ completed)
- **Assistant Messages**: Clean markdown-rendered responses
- **Error Messages**: Red-highlighted errors with expandable stack traces
- **User Feedback**: Yellow-highlighted feedback messages
- **Execution Results**: Summary cards with duration, token usage, and costs

### Real-time Transparency
- **Processing Spinner**: Animated spinner during agent processing, automatically removed when content arrives
- **Streaming Responses**: Messages appear in real-time as the agent works
- **Status Updates**: Every tool call, result, and state change is displayed immediately
- **Complete Visibility**: See exactly what the agent is doing at each step

## Quick Start

### 1. Start the Server

```bash
# Using deno task (recommended)
deno task example:web-ui

# Or directly
cd examples/web-ui && deno run --allow-all main.ts
```

The server will start on `http://localhost:8000`

### 2. Open in Browser

Navigate to `http://localhost:8000` in your web browser.

### 3. Create Your First Agent

1. Click the **"New Agent"** button in the sidebar
2. Configure the agent:
   - **Working Directory**: Where the agent operates (default: `/tmp/agent-workspace`)
3. Click **"Create Agent"**

### 4. Start Chatting

1. Select an agent from the sidebar
2. Type your message in the input field
3. Press Enter or click Send
4. Watch the streaming response appear

## API Endpoints

The server provides the following REST API endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serve the web UI |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create a new agent |
| DELETE | `/api/agents/:id` | Delete an agent |
| POST | `/api/chat` | Send message (SSE stream) |
| DELETE | `/api/sessions` | Clear agent session |

## Configuration

### Default MCP Server

The server comes pre-configured with the hypha MCP server:
```json
{
  "name": "hypha-mcp",
  "url": "https://hypha.aicell.io/ws-user-github%7C478667/mcp/~/mcp",
  "transport": "http"
}
```

This provides 30+ additional tools for workspace management, service registry, and more.

### Custom MCP Servers

You can add custom MCP servers when creating an agent. The configuration accepts:
- HTTP/HTTPS endpoints
- WebSocket connections  
- Local stdio servers

## Testing

### Quick Test

```bash
# Ensure server is running first
deno task example:web-ui

# In another terminal, create an agent and send a test message
deno run --allow-all examples/web-ui/quick_test.ts
```

### Rich UI Test

```bash
# Test all rich UI components
deno run --allow-all examples/web-ui/test_rich_ui.ts
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  Web Server  │────▶│   Manager   │
│    (UI)     │◀────│  (Deno.serve)│◀────│   (Agents)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │   Static     │     │  Claude SDK │
                    │   HTML/JS    │     │   + MCP     │
                    └──────────────┘     └─────────────┘
```

## UI Features

### Sidebar
- Agent list with visual status indicators
- Quick agent creation button
- Delete agents with confirmation

### Main Chat Area
- Clean message display with sender identification
- Syntax highlighting for code blocks
- Tool usage visualization
- Todo list rendering
- Typing indicators

### Input Area
- Message input with Enter to send
- Send button with visual feedback
- Clear session button
- Disabled state when no agent selected

## Development

### File Structure
```
examples/web-ui/
├── main.ts              # Fresh server entry point
├── fresh.config.ts      # Server configuration (port 8000)
├── fresh.gen.ts         # Auto-generated Fresh routes
├── lib/
│   └── manager.ts       # Shared AgentManager instance
├── routes/
│   ├── index.tsx        # Main UI page (Preact/JSX)
│   └── api/
│       ├── agents.ts    # Agent CRUD operations
│       ├── agents/
│       │   └── [id].ts  # Agent deletion endpoint
│       ├── chat.ts      # Chat streaming endpoint (SSE)
│       └── stop.ts      # Stop agent execution
├── static/
│   └── app.js           # Client-side JavaScript with rich rendering
├── test_rich_ui.ts      # Test script for rich UI components
├── quick_test.ts        # Quick test to create agent and send message
└── README.md            # This file
```

### Customization

The UI is built with Fresh and Preact. To customize:

1. **Styling**: Modify the Tailwind classes or add custom CSS
2. **Features**: Add new API endpoints and UI components
3. **MCP Servers**: Configure default servers in the manager initialization

## Troubleshooting

### Server Won't Start
- Ensure no other process is using port 8000
- Check Fresh dependencies: `cd examples/web-ui && deno cache main.ts`

### MCP Not Working
- Verify MCP server URLs are accessible
- Check `.mcp.json` is created in agent directories
- Ensure `.claude/settings.local.json` exists with `enableAllProjectMcpServers: true`

### Agent Creation Fails
- Check write permissions for working directories
- Verify the Claude Code SDK is properly installed
- Look for error messages in browser console

## Performance

- Supports multiple concurrent agents
- Streaming responses for low latency
- Efficient SSE implementation
- Session caching for faster subsequent messages

## Security Notes

- CORS enabled for development (restrict in production)
- No authentication (add for production use)
- Agents run with full permissions (configure as needed)
- MCP servers should be trusted sources

## License

Part of the Claude Code Deno Agent project.