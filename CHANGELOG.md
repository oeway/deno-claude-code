# Changelog

All notable changes to this project will be documented in this file.

## [0.1.11] - 2025-12-09

### Fixed
- **API Key Environment Variable**: Explicitly pass ANTHROPIC_API_KEY to SDK subprocess
  - SDK subprocess was not inheriting environment variables
  - Now explicitly passes ANTHROPIC_API_KEY via env option
  - Fixes "Invalid API key" error in containerized environments

### Docker Images
- `oeway/deno-claude-code:0.1.11`
- `oeway/deno-claude-code:latest`

## [0.1.10] - 2025-12-09

### Fixed
- **Node.js Dependency**: Added Node.js installation to Docker image
  - Claude Agent SDK requires Node.js for ProcessTransport subprocess
  - Without Node.js, SDK fails with "ProcessTransport output stream not available"
  - Installed Node.js 20.x in container using NodeSource repository
  - Fixes remote execution in Kubernetes environments

### Docker Images
- `oeway/deno-claude-code:0.1.10`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`

## [0.1.9] - 2025-12-09

### Fixed
- **MCP Server Compatibility**: Disabled MCP servers to resolve ProcessTransport issues
  - MCP servers cause "ProcessTransport output stream not available" error
  - Temporarily disabled until SDK provides proper fix
  - All core functionality works without MCP servers

### Added
- Local test script ([test_local.ts](test_local.ts)) for quick validation
  - Run with: `deno run --allow-all test_local.ts`
  - Tests agent creation and simple execution
  - Verified working without ProcessTransport errors

### Docker Images
- `oeway/deno-claude-code:0.1.9`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:e121dfc08d0c1fa3e122462772379aaa150bfc427226e126360fa532ddafef6d`

## [0.1.8] - 2025-12-09

### Fixed
- **ProcessTransport Timing Issue**: Resolved "ProcessTransport is not ready for writing" errors
  - Converted string prompts to async generators to ensure proper SDK initialization
  - Workaround for SDK bug where string prompts close transport before MCP initialization
  - Based on solution from https://github.com/anthropics/claude-agent-sdk-python/issues/386
  - Ensures transport stays open until all SDK initialization completes

### Docker Images
- `oeway/deno-claude-code:0.1.8`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:3540db0eaf9fa0ce4eecc4ee47a032e65e63c718c85396574bc62475e5de0d4d`

## [0.1.7] - 2025-12-09

### Changed
- **Single-Threaded Architecture**: Removed worker-based isolation for simplicity and reliability
  - Eliminated worker-agent.ts and all worker-related complexity
  - Agents run directly in the main thread
  - No more worker communication overhead
  - Clean, elegant, and predictable execution model
  - Removed all initialization warmup logic - let the SDK handle its own initialization naturally
  - No arbitrary waits or retry loops - everything is in control

### Removed
- Worker-based agent isolation (worker-agent.ts)
- Comlink RPC dependencies for worker communication
- Worker permissions configuration
- Deno worker API usage

### Docker Images
- `oeway/deno-claude-code:0.1.7`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:ddb77453d11ca373532b32fb5dcb0287fcc3ead9afa3d793b138ed829389107e`

## [0.1.6] - 2025-12-09

### Fixed
- **Agent Subprocess Initialization Retry Logic**: Implemented robust retry mechanism
  - Added retry loop (5 attempts with 500ms delay) for subprocess initialization
  - Only marks agent as ready after receiving successful response from warmup command
  - Prevents "ProcessTransport is not ready for writing" errors more reliably
  - Added detailed logging for initialization attempts
  - Ensures subprocess is truly ready before accepting commands

### Docker Images
- `oeway/deno-claude-code:0.1.6`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:e1f9e342fb2a6e703c343871202d978898e1790da877743beb002fd66dfcfced`

## [0.1.5] - 2025-12-09

### Fixed
- **Agent Subprocess Initialization**: Implemented basic subprocess readiness checking
  - Added `waitUntilReady()` method that verifies subprocess is ready
  - Replaced arbitrary 2-second delay with initialization via test command
  - Agent constructor runs a warmup command to initialize Claude Code SDK subprocess
  - Note: This version still had issues with marking agent ready too early

### Changed
- **Test Client Simplification**: Removed AgentManagerClient class from test_services.py
  - Simplified to linear workflow functions only
  - Default behavior now runs end-to-end cat gallery workflow
  - Cleaner, more straightforward code examples

### Docker Images
- `oeway/deno-claude-code:0.1.5`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:365aee110bb032e40e28533c741fc7480d12fb73caab7efe9fa1e7f928cfd2af`

## [0.1.4] - 2025-12-09

### Fixed
- **ProcessTransport Error Handling**: Improved error handling in execute() method
  - Added try-catch block to handle "ProcessTransport is not ready for writing" errors
  - Better error logging and propagation for agent execution failures
  - Fixed TypeScript type narrowing issues in executeStreaming method

### Docker Images
- `oeway/deno-claude-code:0.1.4`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:924612d67612a009be1521d9c410719630415dd680181ae5e55416dc7f4f3c39`

## [0.1.3] - 2025-12-09

### Added
- Python test clients for service testing
  - `test_client.py` - Automated test suite
  - `test_services.py` - Interactive menu-driven client
- Comprehensive documentation
  - `docs/python-client-examples.md` - Python client usage guide
  - `BUILD.md` - Build and deployment guide

### Changed
- Updated Claude Agent SDK to version 0.1.61
- Version bumped to 0.1.3 in `deno.json`

### Fixed
- **Worker.deno.permissions Error**: Added `--node-modules-dir` flag for proper npm module resolution
  - Updated `start-hypha-service.sh` with required flags
  - Updated `Dockerfile` CMD with proper flags
  - Added `--unstable-worker-options` flag

- **Permission Denied Error**: Fixed container permissions for non-root user
  - Set proper ownership of `/app` directory to UID 1000:1000
  - Added explicit `USER 1000:1000` directive in Dockerfile
  - Ensures node_modules can be created by the container user
  - Matches Kubernetes securityContext requirements

- **Platform Compatibility**: Improved Docker build for AMD64 platforms
  - Updated build script for proper cross-platform builds
  - Fixed "exec format error" on AMD64 Kubernetes clusters

### Docker Images
- `oeway/deno-claude-code:0.1.3`
- `oeway/deno-claude-code:latest`
- Digest: `sha256:f98ed1bdcab12b64cd1f5b03c959920f8d296e2f952070ed4c8041edc88ad0fc`
- Digest: `sha256:f80f87e5378fb18a1d9127d410813112fc93acf716c545d965d6dd163113a36e`

## [0.1.2] - 2025-12-08

### Added
- Initial Docker support
- Kubernetes deployment files

### Changed
- Updated to use Claude Agent SDK

## [0.1.1] - 2025-12-07

### Added
- Hypha service integration
- Agent lifecycle management

## [0.1.0] - 2025-12-06

### Added
- Initial release
- Basic agent management functionality
