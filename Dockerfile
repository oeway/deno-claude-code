# Use official Deno image (match local version)
FROM denoland/deno:2.5.4

# Install Node.js (required by Claude Agent SDK for ProcessTransport)
USER root
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files first for better caching
COPY deno.json deno.lock ./

# Cache dependencies (allow imports from unpkg.com and deno.land)
RUN deno cache --allow-import=unpkg.com,deno.land --lock=deno.lock src/mod.ts || true

# Copy the rest of the application
COPY . .

# Cache the application with dependencies
RUN deno cache --allow-import=unpkg.com,deno.land --lock=deno.lock src/hypha-service.ts

# Create directory for agent workspaces and set permissions
RUN mkdir -p /app/agent-workspaces /home/deno/.claude && \
    chown -R 1000:1000 /app /home/deno

# Environment variables (can be overridden at runtime)
ENV HOME=/home/deno
ENV AGENT_BASE_DIRECTORY=/app/agent-workspaces
ENV AGENT_MAX_COUNT=10
ENV SERVICE_ID=claude-agent-manager
ENV SERVICE_VISIBILITY=public
ENV HYPHA_SERVER_URL=https://hypha.aicell.io

# Expose any necessary ports (if needed in the future)
# EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD deno eval "Deno.exit(0)"

# Switch to non-root user (matches securityContext in k8s)
USER 1000:1000

# Run the Hypha service
CMD ["deno", "run", "--allow-all", "--unstable-worker-options", "--node-modules-dir", "src/hypha-service.ts"]
