# Python Client Examples

This document provides examples of how to use Python to connect to and interact with the Claude Agent Manager Hypha service.

## Installation

First, install the required Python package:

```bash
pip install hypha-rpc
```

## Test Scripts

Two test scripts are provided:

### 1. `test_client.py` - Automated Test Suite

Runs a comprehensive suite of automated tests demonstrating all service features.

**Usage:**
```bash
python test_client.py
```

**What it tests:**
- Basic agent creation and execution
- Streaming execution with real-time updates
- File operations
- Managing multiple agents simultaneously
- Service help and capabilities

### 2. `test_services.py` - Interactive Client

Provides an interactive menu-driven interface for manual testing.

**Usage:**

Interactive mode:
```bash
python test_services.py
```

Quick automated test:
```bash
python test_services.py --quick
```

**Features:**
- Create and manage agents
- Execute commands with streaming or simple mode
- List all active agents
- View manager information
- Interactive permission handling

## Basic Usage Examples

### Connect to the Service

```python
from hypha_rpc import connect_to_server

async def connect():
    # Connect to Hypha server
    server = await connect_to_server({
        "server_url": "https://hypha.aicell.io"
    })

    # Get the Claude Agent Manager service
    service = await server.get_service("claude-agent-manager")

    return server, service
```

### Create an Agent

```python
# Create agent with default settings
agent = await service.createAgent({
    "name": "MyAgent",
    "permissionMode": "bypassPermissions"  # No permission prompts
})

print(f"Agent ID: {agent['id']}")
print(f"Working directory: {agent['workingDirectory']}")
```

### Execute a Command (Non-Streaming)

```python
# Simple execution that returns all results at once
results = await service.execute({
    "agentId": agent['id'],
    "prompt": "What is 2+2?"
})

# Display results
for result in results:
    if 'display_message' in result:
        print(result['display_message'])
```

### Execute with Streaming

```python
# Streaming execution for real-time updates
stream = await service.executeStreaming({
    "agentId": agent['id'],
    "prompt": "List files in the current directory"
})

# Process updates as they arrive
async for update in stream:
    if 'display_message' in update:
        print(update['display_message'])

    # Check for completion
    if update['type'] in ['done', 'error', 'aborted']:
        break
```

### List All Agents

```python
agents = await service.getAllAgents()

for agent in agents:
    print(f"Name: {agent['name']}")
    print(f"ID: {agent['id']}")
    print(f"Directory: {agent['workingDirectory']}")
```

### Remove an Agent

```python
# Remove agent but keep its working directory
await service.removeAgent(agent['id'], keepDirectory=True)

# Remove agent and delete its working directory
await service.removeAgent(agent['id'], keepDirectory=False)
```

## Advanced Examples

### Using Custom System Prompts

```python
# Create agent with Claude Code preset
agent = await service.createAgent({
    "name": "CodeAgent",
    "systemPrompt": {
        "type": "preset",
        "preset": "claude_code"
    },
    "settingSources": ["project"]  # Load project settings
})
```

### Configure Allowed Tools

```python
# Create agent with specific tools only
agent = await service.createAgent({
    "name": "RestrictedAgent",
    "allowedTools": ["Read", "Bash", "Write"],
    "permissionMode": "bypassPermissions"
})
```

### Using Programmatic Subagents

```python
# Create agent with custom subagents
agent = await service.createAgent({
    "name": "MainAgent",
    "agents": {
        "code-reviewer": {
            "description": "Reviews code for quality",
            "prompt": "You are a code reviewer. Focus on best practices.",
            "tools": ["Read", "Grep"]
        },
        "test-runner": {
            "description": "Runs tests",
            "prompt": "You run and analyze tests.",
            "tools": ["Bash", "Read"]
        }
    }
})
```

### Handle Permission Requests

```python
# Create agent that requires permissions
agent = await service.createAgent({
    "name": "PermissionAgent",
    "permissionMode": "default"  # Will ask for permissions
})

# Execute with permission handling
stream = await service.executeStreaming({
    "agentId": agent['id'],
    "prompt": "Create a file called test.txt"
})

async for update in stream:
    if update['type'] == 'permission':
        # Handle permission request
        perm_req = update['permissionRequest']

        # Respond to permission
        await service.respondToPermission({
            "requestId": perm_req['id'],
            "action": "allow"  # or "deny" or "allow_permanent"
        })
    elif 'display_message' in update:
        print(update['display_message'])

    if update['type'] in ['done', 'error', 'aborted']:
        break
```

### Working with Sessions

```python
# Create a session for conversation continuity
session_id = "my-session-123"

# First command
await service.executeStreaming({
    "agentId": agent['id'],
    "prompt": "My name is Alice",
    "sessionId": session_id
})

# Second command - agent remembers previous context
stream = await service.executeStreaming({
    "agentId": agent['id'],
    "prompt": "What is my name?",
    "sessionId": session_id
})
```

### Complete Example with Error Handling

```python
import asyncio
from hypha_rpc import connect_to_server

async def main():
    server = None
    agent_id = None

    try:
        # Connect
        server = await connect_to_server({
            "server_url": "https://hypha.aicell.io"
        })
        print(f"Connected to workspace: {server.config.workspace}")

        # Get service
        service = await server.get_service("claude-agent-manager")

        # Create agent
        agent = await service.createAgent({
            "name": "ExampleAgent",
            "permissionMode": "bypassPermissions"
        })
        agent_id = agent['id']
        print(f"Created agent: {agent_id}")

        # Execute command
        stream = await service.executeStreaming({
            "agentId": agent_id,
            "prompt": "What is the capital of France?"
        })

        async for update in stream:
            if 'display_message' in update:
                print(update['display_message'])

            if update['type'] == 'done':
                print("✅ Success!")
                break
            elif update['type'] == 'error':
                print(f"❌ Error: {update.get('error')}")
                break

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        if agent_id and service:
            try:
                await service.removeAgent(agent_id)
                print(f"Cleaned up agent")
            except:
                pass

        if server:
            await server.disconnect()
            print("Disconnected")

if __name__ == "__main__":
    asyncio.run(main())
```

## Stream Update Types

When using streaming execution, you'll receive different types of updates:

- `stream`: Regular agent response with data
- `permission`: Permission request requiring user response
- `error`: An error occurred
- `done`: Execution completed successfully
- `aborted`: Execution was aborted

Each update includes a `display_message` field with a human-readable formatted message.

## Service Methods Reference

### Agent Lifecycle
- `createAgent(options)` - Create a new agent
- `getAgent(agentId)` - Get agent information
- `getAllAgents()` - List all agents
- `removeAgent(agentId, keepDirectory)` - Remove an agent
- `removeAllAgents(keepDirectories)` - Remove all agents

### Execution
- `execute(options)` - Non-streaming execution
- `executeStreaming(options)` - Streaming execution
- `stopAgent(agentId)` - Stop agent execution

### Permission Handling
- `respondToPermission(response)` - Respond to permission request

### Information
- `getInfo()` - Get manager information
- `ping()` - Health check
- `help()` - Service documentation

## Tips

1. **Use streaming for long-running tasks** - Get real-time updates
2. **Set `bypassPermissions` for automation** - Avoid permission prompts
3. **Use sessions for conversations** - Maintain context across commands
4. **Clean up agents when done** - Remove unused agents to free resources
5. **Handle errors gracefully** - Always use try/except blocks
6. **Monitor display_message** - It provides formatted, human-readable output

## Troubleshooting

### Service not found
```bash
# Make sure the service is running:
deno run --allow-all src/hypha-service.ts
```

### Connection errors
```python
# Try specifying the server URL explicitly
server = await connect_to_server({
    "server_url": "https://hypha.aicell.io"  # or your custom server
})
```

### Permission denied
```python
# Use bypassPermissions mode for testing
agent = await service.createAgent({
    "permissionMode": "bypassPermissions"
})
```

## Further Reading

- [Hypha Getting Started Guide](../../hypha/docs/getting-started.md)
- [Claude Agent SDK API](./claude-agent-sdk-api.md)
- [Hypha Service Implementation](../src/hypha-service.ts)
