#!/bin/bash

# Build and push Docker image for deno-claude-code
# Usage: ./build-and-push.sh [version]

set -e

# Configuration
IMAGE_NAME="oeway/deno-claude-code"
VERSION="${1:-0.1.0}"
FULL_IMAGE="${IMAGE_NAME}:${VERSION}"
LATEST_IMAGE="${IMAGE_NAME}:latest"

echo "=================================="
echo "Building Docker Image"
echo "=================================="
echo "Image: ${FULL_IMAGE}"
echo "Latest: ${LATEST_IMAGE}"
echo ""

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t "${FULL_IMAGE}" -t "${LATEST_IMAGE}" .

echo ""
echo "✅ Build completed successfully!"
echo ""

# Ask for confirmation before pushing
read -p "Do you want to push the image to Docker Hub? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Pushing image to Docker Hub..."
    docker push "${FULL_IMAGE}"
    docker push "${LATEST_IMAGE}"
    echo ""
    echo "✅ Successfully pushed:"
    echo "   - ${FULL_IMAGE}"
    echo "   - ${LATEST_IMAGE}"
else
    echo "⏭️  Skipping push to Docker Hub"
    echo ""
    echo "To push manually later, run:"
    echo "   docker push ${FULL_IMAGE}"
    echo "   docker push ${LATEST_IMAGE}"
fi

echo ""
echo "=================================="
echo "Done!"
echo "=================================="
