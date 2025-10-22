#!/bin/bash

# Launch Kubernetes job for Claude Agent Worker
# This script helps deploy the claude-agent worker to Kubernetes cluster in the hypha namespace

set -e

NAMESPACE="hypha"
JOB_MANIFEST="k8s-job.yaml"

echo "=================================="
echo "Claude Agent K8s Job Launcher"
echo "=================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    echo "Please install kubectl first: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo "⚠️  Namespace '${NAMESPACE}' does not exist"
    read -p "Do you want to create it? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Creating namespace ${NAMESPACE}..."
        kubectl create namespace "${NAMESPACE}"
        echo "✅ Namespace created"
    else
        echo "❌ Cannot proceed without namespace. Exiting."
        exit 1
    fi
fi

echo ""

# Check if secrets exist
echo "🔍 Checking for required secrets..."
echo ""

SECRET_MISSING=0

if ! kubectl get secret anthropic-api-key -n "${NAMESPACE}" &> /dev/null; then
    echo "⚠️  Secret 'anthropic-api-key' not found in namespace '${NAMESPACE}'"
    echo ""
    echo "To create it, run:"
    echo "  kubectl create secret generic anthropic-api-key \\"
    echo "    --from-literal=api-key=YOUR_ANTHROPIC_API_KEY \\"
    echo "    -n ${NAMESPACE}"
    echo ""
    SECRET_MISSING=1
fi

if ! kubectl get secret hypha-config -n "${NAMESPACE}" &> /dev/null; then
    echo "ℹ️  Secret 'hypha-config' not found (optional)"
    echo ""
    echo "To create it (optional), run:"
    echo "  kubectl create secret generic hypha-config \\"
    echo "    --from-literal=workspace=YOUR_WORKSPACE \\"
    echo "    --from-literal=token=YOUR_TOKEN \\"
    echo "    -n ${NAMESPACE}"
    echo ""
fi

if [ $SECRET_MISSING -eq 1 ]; then
    read -p "Required secret is missing. Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Exiting. Please create the required secrets first."
        exit 1
    fi
fi

echo ""
echo "📋 Job Configuration:"
echo "  - Namespace: ${NAMESPACE}"
echo "  - Image: oeway/deno-claude-code:0.1.0"
echo "  - Manifest: ${JOB_MANIFEST}"
echo ""

# Check if job already exists and offer to delete it
if kubectl get job claude-agent-worker -n "${NAMESPACE}" &> /dev/null; then
    echo "⚠️  Job 'claude-agent-worker' already exists"
    read -p "Do you want to delete the existing job? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing job..."
        kubectl delete job claude-agent-worker -n "${NAMESPACE}"
        echo "✅ Existing job deleted"
        echo ""
    else
        echo "❌ Cannot create job while it already exists. Exiting."
        exit 1
    fi
fi

# Apply the job
echo "🚀 Launching Kubernetes job..."
kubectl apply -f "${JOB_MANIFEST}"

echo ""
echo "✅ Job launched successfully!"
echo ""
echo "📊 To monitor the job:"
echo "  kubectl get jobs -n ${NAMESPACE}"
echo "  kubectl describe job claude-agent-worker -n ${NAMESPACE}"
echo ""
echo "📝 To view logs:"
echo "  kubectl logs -f job/claude-agent-worker -n ${NAMESPACE}"
echo ""
echo "🗑️  To delete the job:"
echo "  kubectl delete job claude-agent-worker -n ${NAMESPACE}"
echo ""
echo "=================================="
echo "Done!"
echo "=================================="
