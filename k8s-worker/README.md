# Hypha K8s Worker

A Kubernetes worker that connects to Hypha server and provides job orchestration services. It can launch Kubernetes Jobs including special Claude agent jobs.

## Features

- Connects to Hypha server and registers as a worker service
- Launches Kubernetes Jobs instead of standalone Pods
- Special support for `claude-agent` job type
- Waits for Hypha service registration when requested
- RBAC-enabled for Job and Pod management

## Docker Image

```bash
oeway/hypha-k8s-worker:0.1.0
```

## Prerequisites

1. Kubernetes cluster with access to create Jobs and Pods
2. Hypha server running (either external or in-cluster)
3. Secret containing `HYPHA_AGENTS_TOKEN`

## Quick Start

### 1. Create the secret

```bash
kubectl create secret generic hypha-secrets \
  --from-literal=HYPHA_AGENTS_TOKEN=<your-token> \
  -n hypha
```

### 2. Deploy using Helm

```bash
# From the k8s-worker directory
./deploy-worker.sh
```

Or manually:

```bash
helm install hypha-k8s-worker ./helm/hypha-k8s-worker \
  -n hypha \
  --create-namespace
```

### 3. Verify deployment

```bash
# Check pod status
kubectl get pods -n hypha -l app.kubernetes.io/name=hypha-k8s-worker

# View logs
kubectl logs -n hypha -l app.kubernetes.io/name=hypha-k8s-worker -f
```

## Configuration

Edit `helm/hypha-k8s-worker/values.yaml` to customize:

### Hypha Connection

```yaml
hypha:
  serverUrl: "http://hypha-server.hypha.svc.cluster.local:9520"  # Internal cluster service
  workspace: "hypha-agents"
  serviceId: "k8s-worker"
  visibility: "protected"
  existingSecret: "hypha-secrets"
  tokenKey: "HYPHA_AGENTS_TOKEN"
```

### Kubernetes Settings

```yaml
kubernetes:
  namespace: "hypha"  # Namespace where jobs will be created
  defaultTimeout: "3600"  # Default job timeout in seconds
  imagePullPolicy: "IfNotPresent"
```

### Resources

```yaml
resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

## Usage

The worker registers with Hypha and provides a service with these methods:

### Launch a regular Kubernetes Job

```python
# From another Hypha service
k8s_worker = await server.get_service("hypha-agents/k8s-worker")

session = await k8s_worker.start({
    "manifest": {
        "type": "k8s-job",
        "image": "python:3.11",
        "command": ["python", "-c", "print('Hello from K8s Job!')"]
    }
})
```

### Launch a Claude Agent Job

```python
session = await k8s_worker.start({
    "manifest": {
        "type": "claude-agent",
        "service_id": "my-agent",
        "wait_for_service": True,  # Wait for service registration
        "secret_name": "deno-claude-code-config"  # Optional
    }
})

# If wait_for_service=True, the service will be available at:
# workspace/service_id (e.g., "hypha-agents/my-agent")
```

## Supported Job Types

### 1. `k8s-job` (default)
Standard Kubernetes Job with custom image and command.

**Manifest fields:**
- `image`: Container image to use
- `command`: Command to run
- `env`: Environment variables (optional)
- `resources`: Resource limits/requests (optional)

### 2. `claude-agent`
Special job type that launches a Claude agent container.

**Manifest fields:**
- `service_id`: The service ID for the agent (default: "claude-agents")
- `secret_name`: Secret containing ANTHROPIC_API_KEY and HYPHA_TOKEN (default: "deno-claude-code-config")
- `wait_for_service`: Wait for the service to register (default: false)
- `service_timeout`: Timeout for service wait in seconds (default: 120)

**Environment variables set:**
- `HYPHA_SERVER_URL`: From worker config
- `HYPHA_WORKSPACE`: From manifest or worker config
- `HYPHA_CLIENT_ID`: Generated from session ID
- `SERVICE_ID`: From manifest
- `SERVICE_VISIBILITY`: From manifest (default: "protected")
- `AGENT_BASE_DIRECTORY`: "/workspace"
- `AGENT_MAX_COUNT`: "1"
- `ANTHROPIC_API_KEY`: From secret
- `HYPHA_TOKEN`: From secret

## Architecture

```
┌─────────────────┐
│  Hypha Server   │
│                 │
└────────┬────────┘
         │
         │ WebSocket
         │
┌────────▼─────────────────────┐
│  Hypha K8s Worker (Pod)      │
│  - Connects to Hypha         │
│  - Registers worker service  │
│  - Creates Jobs on demand    │
└────────┬─────────────────────┘
         │
         │ Kubernetes API
         │
┌────────▼─────────────────────┐
│  Kubernetes Jobs             │
│  - Regular jobs              │
│  - Claude agent jobs         │
└──────────────────────────────┘
```

## Development

### Build Docker image

```bash
docker buildx build --platform linux/amd64 \
  -t oeway/hypha-k8s-worker:0.1.0 \
  -t oeway/hypha-k8s-worker:latest \
  --push .
```

### Test locally

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export HYPHA_SERVER_URL=https://hypha.aicell.io
export HYPHA_WORKSPACE=hypha-agents
export HYPHA_TOKEN=<your-token>
export HYPHA_K8S_NAMESPACE=hypha

# Run the worker
python -m k8s
```

## Troubleshooting

### Worker pod not starting

```bash
# Check pod status
kubectl describe pod -n hypha -l app.kubernetes.io/name=hypha-k8s-worker

# Check logs
kubectl logs -n hypha -l app.kubernetes.io/name=hypha-k8s-worker
```

### Jobs not being created

Check RBAC permissions:

```bash
# Verify role and rolebinding
kubectl get role,rolebinding -n hypha
```

### Service not registering in Hypha

Check the worker can connect to Hypha server:

```bash
# Exec into pod
kubectl exec -it -n hypha <pod-name> -- bash

# Test connection
curl -v http://hypha-server.hypha.svc.cluster.local:9520/health
```

## License

Same as parent project.
