# Migration Guide: Claude Agent SDK v2.0

This guide covers the migration from the old Claude Code SDK to the new Claude Agent SDK.

## What Changed

The deno-claude-code library has been upgraded to use the new **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) which replaces the old Claude Code SDK (`@anthropic-ai/claude-code`).

### Key Changes

| Aspect | Old (v1.x) | New (v2.0) |
|--------|-----------|-----------|
| SDK Package | `@anthropic-ai/claude-code@1.0.89` | `@anthropic-ai/claude-agent-sdk` |
| Permission Mode | `strict` mode removed | `default`, `acceptEdits`, `bypassPermissions`, `plan` |
| System Prompt | Claude Code prompt by default | Empty by default (opt-in) |
| Settings Loading | All filesystem settings loaded | No settings by default (opt-in) |
| MCP Configuration | Via `.mcp.json` files | Direct SDK configuration |
| Subagents | Not available | Programmatic definition supported |

## Breaking Changes

### 1. System Prompt No Longer Default

**Before (v1.x):**
```typescript
const agent = await manager.createAgent({
  permissionMode: "bypassPermissions"
});
// Used Claude Code's system prompt automatically
```

**After (v2.0):**
```typescript
// Empty system prompt by default
const agent = await manager.createAgent({
  permissionMode: "bypassPermissions"
});

// To use Claude Code's system prompt:
const agent = await manager.createAgent({
  permissionMode: "bypassPermissions",
  systemPrompt: { type: "preset", preset: "claude_code" }
});

// Or use a custom prompt:
const agent = await manager.createAgent({
  permissionMode: "bypassPermissions",
  systemPrompt: "You are a helpful coding assistant"
});
```

### 2. Settings Not Loaded by Default

**Before (v1.x):**
```typescript
// Automatically loaded:
// - ~/.claude/settings.json
// - .claude/settings.json
// - .claude/settings.local.json
// - CLAUDE.md files
const agent = await manager.createAgent({ ... });
```

**After (v2.0):**
```typescript
// No settings loaded by default
const agent = await manager.createAgent({ ... });

// To load project settings (CLAUDE.md):
const agent = await manager.createAgent({
  settingSources: ["project"],
  systemPrompt: { type: "preset", preset: "claude_code" } // Required for CLAUDE.md
});

// To load all settings (like v1.x):
const agent = await manager.createAgent({
  settingSources: ["user", "project", "local"],
  systemPrompt: { type: "preset", preset: "claude_code" }
});
```

### 3. MCP Configuration Changes

**Before (v1.x):**
```typescript
// Created .mcp.json files automatically
const agent = await manager.createAgent({
  mcpServers: [{ name: "my-server", url: "http://..." }]
});
```

**After (v2.0):**
```typescript
// MCP servers passed directly to SDK (no .mcp.json files)
const agent = await manager.createAgent({
  mcpServers: [{ name: "my-server", url: "http://..." }]
});
// Works the same, but no filesystem configuration created
```

### 4. Permission Mode "strict" Removed

**Before (v1.x):**
```typescript
const agent = await manager.createAgent({
  permissionMode: "strict" // Not truly isolated due to SDK limitations
});
```

**After (v2.0):**
```typescript
// "strict" mode removed - use "default" for standard permissions
const agent = await manager.createAgent({
  permissionMode: "default"
});
```

## New Features

### 1. Programmatic Subagents

Define specialized subagents that the main agent can delegate tasks to:

```typescript
const agent = await manager.createAgent({
  name: "MainAgent",
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer",
      prompt: "You are an expert code reviewer. Focus on quality and best practices.",
      tools: ["Read", "Grep", "Glob"],
      model: "sonnet"
    },
    "test-writer": {
      description: "Specialized in writing tests",
      prompt: "You are a test writing specialist.",
      tools: ["Read", "Write", "Grep"],
      model: "sonnet"
    }
  }
});
```

### 2. Enhanced Tool Control

Use both `allowedTools` and `disallowedTools`:

```typescript
const agent = await manager.createAgent({
  allowedTools: ["Read", "Write", "Grep", "Glob"],
  disallowedTools: ["Bash", "KillBash"] // Explicitly block dangerous tools
});
```

### 3. Model Selection

Specify models and fallbacks:

```typescript
const agent = await manager.createAgent({
  model: "claude-sonnet-4-5-20250929",
  fallbackModel: "claude-sonnet-3-5-20241022",
  maxThinkingTokens: 10000
});
```

### 4. Extended Configuration

```typescript
const agent = await manager.createAgent({
  maxTurns: 20,                    // Maximum conversation turns
  maxThinkingTokens: 10000,        // Maximum tokens for thinking
  includePartialMessages: true,    // Stream partial messages
  additionalDirectories: ["/data"], // Additional accessible directories
  env: { CUSTOM_VAR: "value" }     // Custom environment variables
});
```

## Migration Checklist

- [ ] Update error messages referencing "Claude Code SDK" to "Claude Agent SDK"
- [ ] Review agents using filesystem settings - add `settingSources` if needed
- [ ] Review agents expecting Claude Code system prompt - add explicit configuration
- [ ] Remove any manual `.mcp.json` creation (now handled by SDK)
- [ ] Update "strict" permission mode to "default"
- [ ] Consider using new features (subagents, model selection, etc.)
- [ ] Test all agent configurations thoroughly

## Example Migration

**Before (v1.x):**
```typescript
const manager = new AgentManager("./workspace");
await manager.initialize();

const agent = await manager.createAgent({
  name: "CodeAgent",
  permissionMode: "bypassPermissions",
  allowedTools: ["Read", "Write", "Bash"],
  mcpServers: [{ name: "server1", command: "mcp-server" }]
});
```

**After (v2.0):**
```typescript
const manager = new AgentManager("./workspace");
await manager.initialize();

const agent = await manager.createAgent({
  name: "CodeAgent",
  permissionMode: "bypassPermissions",
  allowedTools: ["Read", "Write", "Bash"],
  mcpServers: [{ name: "server1", command: "mcp-server" }],
  // Add if you need Claude Code's coding capabilities:
  systemPrompt: { type: "preset", preset: "claude_code" },
  // Add if you have project settings (CLAUDE.md):
  settingSources: ["project"]
});
```

## Hypha Service Updates

The Hypha service now exposes all new configuration options:

```javascript
// Create agent with advanced features via Hypha
const agent = await service.createAgent({
  name: "AdvancedAgent",
  permissionMode: "bypassPermissions",
  systemPrompt: { type: "preset", preset: "claude_code" },
  agents: {
    "specialist": {
      description: "Specialized helper",
      prompt: "You are a specialist",
      tools: ["Read", "Grep"]
    }
  },
  model: "claude-sonnet-4-5-20250929",
  settingSources: ["project"]
});
```

Call `await service.help()` to see all available options and examples.

## Resources

- [Claude Agent SDK TypeScript Reference](https://docs.anthropic.com/en/api/agent-sdk/typescript)
- [Migration Guide](https://docs.anthropic.com/en/api/agent-sdk/migrate)
- [Examples Directory](./examples/)

## Getting Help

If you encounter issues:

1. Check that all imports reference the new SDK
2. Verify configuration options match the new API
3. Review the examples in `examples/advanced-sdk-features.ts`
4. Check the Hypha service help: `await service.help()`

For the latest SDK documentation, visit: https://docs.anthropic.com/en/api/agent-sdk/overview
