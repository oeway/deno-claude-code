#!/bin/bash

# Deploy deno-claude-code to Kubernetes
# This script builds, pushes, creates secrets, and deploys the service

set -e

NAMESPACE="hypha"
SECRET_NAME="deno-claude-code-config"
JOB_NAME="claude-agent-worker"
IMAGE_NAME="oeway/deno-claude-code"
VERSION="${1:-0.1.0}"

echo "=================================="
echo "Deno Claude Code Deployment"
echo "=================================="
echo ""
echo "Configuration:"
echo "  - Namespace: ${NAMESPACE}"
echo "  - Image: ${IMAGE_NAME}:${VERSION}"
echo "  - Job: ${JOB_NAME}"
echo ""

# Step 1: Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Please create a .env file based on .env.example"
    exit 1
fi

echo "✅ All prerequisites met"
echo ""

# Step 2: Build and push Docker image
echo "🐳 Building and pushing Docker image..."
read -p "Build and push Docker image? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building for linux/amd64 platform..."
    docker buildx build --platform linux/amd64 \
        -t "${IMAGE_NAME}:${VERSION}" \
        -t "${IMAGE_NAME}:latest" \
        --push .
    echo "✅ Docker image built and pushed"
else
    echo "⏭️  Skipping Docker build"
fi
echo ""

# Step 3: Create Kubernetes secrets
echo "🔐 Creating Kubernetes secrets..."

# Check if namespace exists
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo "❌ Namespace '${NAMESPACE}' does not exist"
    exit 1
fi

# Read tokens from .env
ANTHROPIC_API_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")
HYPHA_TOKEN=$(grep "^HYPHA_TOKEN=" .env | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY is missing in .env file"
    exit 1
fi

# Create or update secret
if kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" &> /dev/null; then
    echo "Secret '${SECRET_NAME}' already exists, updating..."
    kubectl delete secret "${SECRET_NAME}" -n "${NAMESPACE}"
fi

# Use heredoc to avoid escaping issues
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: ${SECRET_NAME}
  namespace: ${NAMESPACE}
type: Opaque
stringData:
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
  HYPHA_TOKEN: "${HYPHA_TOKEN}"
EOF

echo "✅ Secret created/updated"
echo ""

# Step 4: Deploy Kubernetes job
echo "🚀 Deploying Kubernetes job..."

# Delete existing job if it exists
if kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" &> /dev/null; then
    echo "Deleting existing job..."
    kubectl delete job "${JOB_NAME}" -n "${NAMESPACE}"
    sleep 2
fi

# Apply the job
kubectl apply -f k8s-job.yaml

echo "✅ Job deployed"
echo ""

# Step 5: Monitor deployment
echo "📊 Monitoring deployment..."
echo ""

# Wait for pod to be created
echo "Waiting for pod to be created..."
for i in {1..30}; do
    POD_NAME=$(kubectl get pods -n "${NAMESPACE}" -l app=claude-agent-worker -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$POD_NAME" ]; then
        echo "✅ Pod created: ${POD_NAME}"
        break
    fi
    sleep 1
done

if [ -z "$POD_NAME" ]; then
    echo "❌ Pod was not created within 30 seconds"
    kubectl describe job "${JOB_NAME}" -n "${NAMESPACE}"
    exit 1
fi

# Wait for pod to be running
echo "Waiting for pod to be running..."
kubectl wait --for=condition=Ready pod/"${POD_NAME}" -n "${NAMESPACE}" --timeout=60s || true

# Show pod status
echo ""
kubectl get pod "${POD_NAME}" -n "${NAMESPACE}"
echo ""

# Show logs
echo "📝 Recent logs:"
echo "---"
kubectl logs "${POD_NAME}" -n "${NAMESPACE}" --tail=20
echo "---"
echo ""

# Step 6: Get service endpoint
echo "=================================="
echo "✅ Deployment Complete!"
echo "=================================="
echo ""

# Extract workspace from .env
WORKSPACE=$(grep "^HYPHA_WORKSPACE=" .env | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")
SERVICE_ID=$(grep "^SERVICE_ID=" k8s-job.yaml | grep 'value:' | cut -d '"' -f2 | head -1)

if [ -n "$WORKSPACE" ] && [ -n "$SERVICE_ID" ]; then
    # URL encode the workspace
    ENCODED_WORKSPACE=$(echo -n "$WORKSPACE" | jq -sRr @uri)
    SERVICE_URL="https://hypha.aicell.io/${ENCODED_WORKSPACE}/services/${SERVICE_ID}"

    echo "🔗 Service Information:"
    echo "   Workspace: ${WORKSPACE}"
    echo "   Service ID: ${SERVICE_ID}"
    echo "   Service URL: ${SERVICE_URL}"
    echo ""
    echo "📊 To check service status:"
    echo "   curl -s ${SERVICE_URL} | jq"
    echo ""
fi

echo "📝 To view logs:"
echo "   kubectl logs -f ${POD_NAME} -n ${NAMESPACE}"
echo ""
echo "🗑️  To delete the job:"
echo "   kubectl delete job ${JOB_NAME} -n ${NAMESPACE}"
echo ""
