#!/bin/bash

# Create Kubernetes secret for sensitive tokens from .env file
set -e

NAMESPACE="hypha"
SECRET_NAME="deno-claude-code-config"

echo "=================================="
echo "Claude Agent K8s Secret Setup"
echo "=================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo "❌ Namespace '${NAMESPACE}' does not exist"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Please create a .env file based on .env.example"
    exit 1
fi

echo "📝 Reading tokens from .env file..."

# Read sensitive tokens from .env file
ANTHROPIC_API_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")
HYPHA_TOKEN=$(grep "^HYPHA_TOKEN=" .env | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")

# Validate required fields
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY is missing in .env file"
    exit 1
fi

echo "✅ Tokens loaded:"
echo "   - ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."
echo "   - HYPHA_TOKEN: ${HYPHA_TOKEN:0:20}..."
echo ""

# Check if secret already exists
if kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" &> /dev/null; then
    echo "⚠️  Secret '${SECRET_NAME}' already exists"
    read -p "Do you want to delete and recreate it? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete secret "${SECRET_NAME}" -n "${NAMESPACE}"
        echo "🗑️  Deleted existing secret"
    else
        echo "Skipping secret creation"
        exit 0
    fi
fi

# Create the secret with only tokens
echo "🚀 Creating secret '${SECRET_NAME}' (tokens only)..."
kubectl create secret generic "${SECRET_NAME}" \
    --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    --from-literal=HYPHA_TOKEN="$HYPHA_TOKEN" \
    -n "${NAMESPACE}"

echo ""
echo "=================================="
echo "✅ Secret created successfully!"
echo "=================================="
echo ""
echo "ℹ️  Note: Non-sensitive configuration (HYPHA_SERVER_URL, HYPHA_WORKSPACE, etc.)"
echo "   should be set directly in k8s-job.yaml as environment variables"
echo ""
echo "To verify:"
echo "  kubectl get secret ${SECRET_NAME} -n ${NAMESPACE}"
echo "  kubectl describe secret ${SECRET_NAME} -n ${NAMESPACE}"
