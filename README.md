# Claude Agent Manager - Hypha Service

A Deno-based service that exposes the Claude Agent Manager through Hypha's distributed service protocol.

## Prerequisites

1. Install [Deno](https://deno.land/)
2. Install Claude Agent SDK:
   ```bash
   npm install -g @anthropic-ai/claude-agent-sdk
   ```
3. Set up your Anthropic API key:
   ```bash
   export ANTHROPIC_API_KEY=your-key-here
   ```

## Quick Start

1. (Optional) Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   # Edit .env and add your HYPHA_TOKEN and ANTHROPIC_API_KEY
   ```

2. Start the service:
   ```bash
   ./start-hypha-service.sh
   ```

## Configuration

The service can be configured via environment variables (either in `.env` file or exported in shell):

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)
- `HYPHA_SERVER_URL` - Hypha server URL (default: https://hypha.aicell.io)
- `HYPHA_WORKSPACE` - Workspace name (optional)
- `HYPHA_TOKEN` - Authentication token (optional)
- `AGENT_BASE_DIRECTORY` - Base directory for agents (default: ./agent-workspaces)
- `AGENT_MAX_COUNT` - Maximum concurrent agents (default: 10)
- `SERVICE_ID` - Service registration ID (default: claude-agent-manager)
- `SERVICE_VISIBILITY` - Service visibility: public/protected (default: public)

## License

MIT
