#!/bin/bash
set -e

# Deploy Hypha K8s Worker using Helm
# This script installs the hypha-k8s-worker to the hypha namespace

NAMESPACE="hypha"
RELEASE_NAME="hypha-k8s-worker"
CHART_PATH="./helm/hypha-k8s-worker"

echo "Deploying Hypha K8s Worker to namespace: $NAMESPACE"

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo "Creating namespace: $NAMESPACE"
    kubectl create namespace "$NAMESPACE"
fi

# Check if secret exists
if ! kubectl get secret hypha-secrets -n "$NAMESPACE" &> /dev/null; then
    echo "ERROR: Secret 'hypha-secrets' not found in namespace '$NAMESPACE'"
    echo "Please create the secret with HYPHA_AGENTS_TOKEN first:"
    echo "  kubectl create secret generic hypha-secrets --from-literal=HYPHA_AGENTS_TOKEN=<token> -n $NAMESPACE"
    exit 1
fi

# Install or upgrade the Helm chart
echo "Installing/upgrading Helm release: $RELEASE_NAME"
helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --wait \
    --timeout 5m

echo ""
echo "Deployment successful!"
echo ""
echo "Check the status with:"
echo "  kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=hypha-k8s-worker"
echo ""
echo "View logs with:"
echo "  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=hypha-k8s-worker -f"
