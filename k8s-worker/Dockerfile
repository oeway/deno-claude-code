# Hypha K8s Worker Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    hypha-rpc>=0.20.38 \
    kubernetes>=28.1.0 \
    pydantic>=2.0.0

# Copy the worker code
COPY base.py k8s.py /app/

# Create a non-root user
RUN useradd -m -u 1000 worker && \
    chown -R worker:worker /app

USER worker

# Environment variables (can be overridden at runtime)
ENV HYPHA_SERVER_URL=https://hypha.aicell.io
ENV HYPHA_K8S_NAMESPACE=default
ENV HYPHA_K8S_IMAGE_PULL_POLICY=IfNotPresent
ENV HYPHA_K8S_DEFAULT_TIMEOUT=3600

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import sys; sys.exit(0)"

# Run the worker
CMD ["python", "-m", "k8s"]
