#!/bin/bash
set -e

# Get HYPHA_TOKEN from kubernetes secret
export HYPHA_TOKEN=$(kubectl get secret hypha-secrets -n hypha -o jsonpath='{.data.HYPHA_AGENTS_TOKEN}' | base64 -d)

if [ -z "$HYPHA_TOKEN" ]; then
    echo "Failed to get HYPHA_TOKEN from kubernetes secret"
    exit 1
fi

echo "Running integration tests..."
python test_worker_integration.py
