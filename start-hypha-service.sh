#!/bin/bash

# Start Claude Agent Manager Hypha Service
# This script starts the Hypha service that exposes the Agent Manager

echo "🚀 Starting Claude Agent Manager Hypha Service..."
echo "================================================"

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Default configuration
HYPHA_SERVER_URL="${HYPHA_SERVER_URL:-https://hypha.aicell.io}"
AGENT_BASE_DIRECTORY="${AGENT_BASE_DIRECTORY:-./agent-workspaces}"
SERVICE_ID="${SERVICE_ID:-claude-agent-manager}"
SERVICE_VISIBILITY="${SERVICE_VISIBILITY:-public}"
AGENT_MAX_COUNT="${AGENT_MAX_COUNT:-10}"

# Display configuration
echo "📋 Configuration:"
echo "  - Hypha Server: $HYPHA_SERVER_URL"
echo "  - Service ID: $SERVICE_ID"
echo "  - Visibility: $SERVICE_VISIBILITY"
echo "  - Base Directory: $AGENT_BASE_DIRECTORY"
echo "  - Max Agents: $AGENT_MAX_COUNT"
echo ""

# Check if workspace or token is provided
if [ ! -z "$HYPHA_WORKSPACE" ]; then
    echo "  - Workspace: $HYPHA_WORKSPACE"
fi

if [ ! -z "$HYPHA_TOKEN" ]; then
    echo "  - Token: [PROVIDED]"
fi

echo "================================================"
echo ""

# Start the service with Deno
deno run \
    --allow-import \
    --allow-net \
    --unstable-worker-options \
    --allow-read \
    --allow-write \
    --allow-env \
    --allow-run \
    src/hypha-service.ts

# Note: The service needs these permissions:
# - allow-net: To connect to Hypha server
# - allow-read: To read agent files and Claude Code SDK
# - allow-write: To create agent workspaces
# - allow-env: To read environment variables
# - allow-run: To execute Claude Code SDK (Node.js)