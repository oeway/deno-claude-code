# Deno Claude Code - Kubernetes Deployment Guide

## Overview

This document describes how to deploy the deno-claude-code service as a Kubernetes job that connects to a Hypha server and provides Claude agent management capabilities.

## Architecture

- **Docker Image**: `oeway/deno-claude-code:0.1.0` (linux/amd64)
- **Kubernetes Namespace**: `hypha`
- **Service Name**: `claude-agents`
- **Service Endpoint**: `https://hypha.aicell.io/ws-user-github%7C478667/services/claude-agents`

## Prerequisites

1. **Docker** with buildx support for multi-platform builds
2. **kubectl** configured to access your Kubernetes cluster
3. **Kubernetes cluster** with the `hypha` namespace
4. **.env file** with required credentials

## Quick Start

### 1. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY and HYPHA_TOKEN
```

Required variables in `.env`:
- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)
- `HYPHA_TOKEN` - Your Hypha authentication token (required)
- `HYPHA_SERVER_URL` - Hypha server URL (default: https://hypha.aicell.io)
- `HYPHA_WORKSPACE` - Workspace identifier (e.g., ws-user-github|478667)

### 2. Deploy Everything

Use the all-in-one deployment script:

```bash
./deploy.sh
```

This script will:
1. Check prerequisites (docker, kubectl, .env file)
2. Build and push the Docker image for linux/amd64
3. Create/update Kubernetes secrets
4. Deploy the Kubernetes job
5. Monitor the deployment
6. Display the service endpoint

### 3. Verify Deployment

Check the service is running:

```bash
# View pod status
kubectl get pods -n hypha -l app=claude-agent-worker

# Follow logs
kubectl logs -f <pod-name> -n hypha

# Test service endpoint
curl -s "https://hypha.aicell.io/ws-user-github%7C478667/services/claude-agents" | jq
```

## Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

### Step 1: Build and Push Docker Image

Build for amd64 architecture:

```bash
docker buildx build --platform linux/amd64 \
  -t oeway/deno-claude-code:0.1.0 \
  -t oeway/deno-claude-code:latest \
  --push .
```

Or use the build script:

```bash
./build-and-push.sh 0.1.0
```

### Step 2: Create Kubernetes Secrets

Create secrets containing your API keys:

```bash
./create-k8s-secrets.sh
```

Or manually:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: deno-claude-code-config
  namespace: hypha
type: Opaque
stringData:
  ANTHROPIC_API_KEY: "your-anthropic-api-key"
  HYPHA_TOKEN: "your-hypha-token"
EOF
```

### Step 3: Deploy Kubernetes Job

```bash
kubectl apply -f k8s-job.yaml
```

Or use the launch script:

```bash
./launch-k8s-job.sh
```

## Service Configuration

The service is configured via environment variables in [k8s-job.yaml](k8s-job.yaml):

| Variable | Value | Source |
|----------|-------|--------|
| `ANTHROPIC_API_KEY` | Your API key | Secret |
| `HYPHA_TOKEN` | Auth token | Secret |
| `HYPHA_SERVER_URL` | https://hypha.aicell.io | ConfigMap |
| `HYPHA_WORKSPACE` | ws-user-github\|478667 | ConfigMap |
| `AGENT_BASE_DIRECTORY` | /app/agent-workspaces | ConfigMap |
| `AGENT_MAX_COUNT` | 10 | ConfigMap |
| `SERVICE_ID` | claude-agents | ConfigMap |
| `SERVICE_VISIBILITY` | public | ConfigMap |

## Available Service Methods

Once deployed, the service exposes the following methods:

- `createAgent` - Create a new agent
- `getAgent` - Get agent information
- `getAllAgents` - List all agents
- `removeAgent` - Remove an agent
- `removeAllAgents` - Remove all agents
- `execute` - Execute command (non-streaming)
- `executeStreaming` - Execute with streaming
- `stopAgent` - Stop agent execution
- `respondToPermission` - Respond to permission requests
- `getInfo` - Get manager information
- `ping` - Health check
- `help` - Get service documentation

## Monitoring

### View Logs

```bash
# Get pod name
kubectl get pods -n hypha -l app=claude-agent-worker

# Follow logs
kubectl logs -f <pod-name> -n hypha

# View recent logs
kubectl logs <pod-name> -n hypha --tail=50
```

### Check Service Status

```bash
# Check job status
kubectl get job claude-agent-worker -n hypha

# Check pod status
kubectl get pods -n hypha -l app=claude-agent-worker

# Describe job for events
kubectl describe job claude-agent-worker -n hypha
```

### Test Service Endpoint

```bash
# Get service info
curl -s "https://hypha.aicell.io/ws-user-github%7C478667/services/claude-agents" | jq

# Ping service
curl -s "https://hypha.aicell.io/ws-user-github%7C478667/services/claude-agents/ping"
```

## Troubleshooting

### Pod Not Starting

Check pod events:
```bash
kubectl describe pod <pod-name> -n hypha
```

Common issues:
- **ImagePullBackOff**: Docker image not found or authentication issue
- **CrashLoopBackOff**: Container starting but failing, check logs
- **PodSecurity violations**: Security context not properly configured

### Authentication Errors

If you see "Error decoding token headers":
- Verify HYPHA_TOKEN is correctly set in the secret
- Check for special character escaping issues
- Recreate secret using the heredoc method in `create-k8s-secrets.sh`

### Architecture Mismatch

Error: `exec /tini: exec format error`

Solution: Rebuild image for correct architecture (linux/amd64):
```bash
docker buildx build --platform linux/amd64 -t oeway/deno-claude-code:0.1.0 --push .
```

## Cleanup

Remove the deployment:

```bash
# Delete job
kubectl delete job claude-agent-worker -n hypha

# (Optional) Delete secrets
kubectl delete secret deno-claude-code-config -n hypha
```

## Files Reference

- `Dockerfile` - Docker image definition
- `.dockerignore` - Files to exclude from Docker build
- `k8s-job.yaml` - Kubernetes job manifest
- `deploy.sh` - All-in-one deployment script
- `build-and-push.sh` - Build and push Docker image
- `create-k8s-secrets.sh` - Create Kubernetes secrets from .env
- `launch-k8s-job.sh` - Deploy Kubernetes job
- `.env.example` - Environment variables template

## Security Notes

1. **Secrets Management**: Sensitive tokens (API keys, auth tokens) are stored in Kubernetes secrets
2. **Pod Security**: Pod runs with restricted security context (non-root, no privilege escalation)
3. **Network**: Service communicates over WSS (WebSocket Secure) with Hypha server
4. **Credentials**: Never commit `.env` file to version control

## Support

For issues or questions:
- Check logs: `kubectl logs <pod-name> -n hypha`
- Review Hypha documentation
- Check Claude Agent SDK documentation
