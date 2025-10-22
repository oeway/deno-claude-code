# Use official Deno image (match local version)
FROM denoland/deno:2.5.4

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

# Create directory for agent workspaces
RUN mkdir -p /app/agent-workspaces

# Environment variables (can be overridden at runtime)
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

# Run the Hypha service
CMD ["deno", "run", "--allow-all", "--unstable", "src/hypha-service.ts"]
