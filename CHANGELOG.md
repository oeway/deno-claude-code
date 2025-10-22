# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-01-XX

### 🚀 Major Update - Claude Agent SDK Integration

This release upgrades the library to use the new **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`), bringing significant new capabilities and improvements.

### ✨ Added

#### Programmatic Subagents
- **NEW**: Define specialized subagents for task delegation
- Subagents can have their own prompts, tools, and models
- Main agent automatically delegates tasks to appropriate subagents

```typescript
agents: {
  "code-reviewer": {
    description: "Expert code reviewer",
    prompt: "Focus on quality and best practices",
    tools: ["Read", "Grep", "Glob"],
    model: "sonnet"
  }
}
```

#### Custom System Prompts
- **NEW**: Full control over agent system prompts
- Choose between custom prompts or Claude Code preset
- Preset required for CLAUDE.md interpretation

```typescript
// Custom
systemPrompt: "You are a data analysis expert"

// Preset
systemPrompt: { type: "preset", preset: "claude_code" }
```

#### Setting Sources Control
- **NEW**: Explicit control over filesystem settings loading
- Choose which settings to load: `user`, `project`, `local`
- Improves isolation and predictability

```typescript
settingSources: ["project"]  // Only load project settings
```

#### Model Selection
- **NEW**: Specify Claude models and fallbacks
- Configure thinking token limits
- Per-agent model configuration

```typescript
model: "claude-sonnet-4-5-20250929"
fallbackModel: "claude-sonnet-3-5-20241022"
maxThinkingTokens: 10000
```

#### Enhanced Tool Control
- **NEW**: `disallowedTools` option for explicit tool blocking
- Combine with `allowedTools` for fine-grained control
- Better security and permission management

```typescript
allowedTools: ["Read", "Write", "Grep"]
disallowedTools: ["Bash", "KillBash"]
```

#### Extended Configuration
- **NEW**: `maxTurns` - Maximum conversation turns
- **NEW**: `includePartialMessages` - Stream partial messages
- **NEW**: `additionalDirectories` - Additional accessible directories
- **NEW**: `env` - Custom environment variables per agent

### 🔄 Changed

#### SDK Package
- **BREAKING**: Updated from `@anthropic-ai/claude-code@1.0.89` to `@anthropic-ai/claude-agent-sdk`
- Package name changed from `@claude-code/deno-agent` to `@claude-agent-sdk/deno-agent`
- Version bumped from 1.0.0 to 2.0.0

#### System Prompt Behavior
- **BREAKING**: No longer uses Claude Code system prompt by default
- Empty system prompt by default for better isolation
- Must explicitly request Claude Code preset if needed

**Migration:**
```typescript
// Before: Claude Code prompt automatic
const agent = await manager.createAgent({ ... });

// After: Explicitly request if needed
const agent = await manager.createAgent({
  systemPrompt: { type: "preset", preset: "claude_code" }
});
```

#### Settings Loading
- **BREAKING**: Filesystem settings no longer loaded by default
- Must specify `settingSources` to load settings
- Improves predictability and isolation

**Migration:**
```typescript
// Before: All settings loaded automatically
const agent = await manager.createAgent({ ... });

// After: Explicitly specify sources
const agent = await manager.createAgent({
  settingSources: ["user", "project", "local"]
});
```

#### MCP Configuration
- **CHANGED**: MCP servers now configured directly via SDK options
- No longer creates `.mcp.json` or `.claude/settings.local.json` files
- Simplified configuration with same API

### 🗑️ Removed

#### Permission Mode
- **BREAKING**: Removed `strict` permission mode
- Use `default`, `acceptEdits`, `bypassPermissions`, or `plan` instead
- `strict` mode was not truly isolated due to SDK requirements

**Migration:**
```typescript
// Before
permissionMode: "strict"

// After
permissionMode: "default"
```

#### File Creation
- Removed automatic creation of `.mcp.json` files
- Removed automatic creation of `.claude/settings.local.json` files
- Configuration now handled entirely by SDK

### 📚 Documentation

- Added comprehensive [MIGRATION.md](./MIGRATION.md) guide
- Added [UPGRADE_SUMMARY.md](./UPGRADE_SUMMARY.md) with complete change overview
- Updated [README.md](./README.md) with new features and examples
- Created [examples/advanced-sdk-features.ts](./examples/advanced-sdk-features.ts) with 6 comprehensive examples
- Enhanced Hypha service help documentation with new features
- Updated all error messages to reference Claude Agent SDK

### 🔧 Technical Changes

- Updated `src/agent.ts` with new SDK options support
- Enhanced `src/types.ts` with new type definitions
- Simplified `src/manager.ts` by removing obsolete file creation
- Maintained backward compatibility in `src/worker-agent.ts`
- Updated `src/hypha-service.ts` with enhanced documentation

### 🧪 Testing

- All existing tests pass without modification
- Type checking passes with new SDK
- Backward compatible core API maintained
- New features ready for testing

### 📦 Dependencies

- Updated to `@anthropic-ai/claude-agent-sdk` (latest)
- All other dependencies unchanged

### 🔗 Resources

- [Official SDK Documentation](https://docs.anthropic.com/en/api/agent-sdk/overview)
- [TypeScript SDK Reference](https://docs.anthropic.com/en/api/agent-sdk/typescript)
- [Migration Guide](./MIGRATION.md)
- [Examples](./examples/)

## [1.0.0] - Previous Release

Previous stable release using `@anthropic-ai/claude-code@1.0.89`.

### Features
- Agent creation and management
- Streaming responses
- Permission control
- Session management
- MCP server support
- Hypha integration
- Worker-based isolation

---

## Migration Guide

For detailed migration instructions, see [MIGRATION.md](./MIGRATION.md).

### Quick Migration Checklist

- [ ] Update SDK: `npm install -g @anthropic-ai/claude-agent-sdk`
- [ ] Add `systemPrompt: { type: "preset", preset: "claude_code" }` if needed
- [ ] Add `settingSources: ["project"]` if using CLAUDE.md
- [ ] Replace `strict` with `default` permission mode
- [ ] Test your agents thoroughly
- [ ] Explore new features in advanced examples

### Getting Started with New Features

```bash
# Run advanced examples
deno task example:advanced

# Basic usage
deno task example:basic

# Streaming
deno task example:streaming
```

For questions or issues, refer to [MIGRATION.md](./MIGRATION.md) or the [official documentation](https://docs.anthropic.com/en/api/agent-sdk/overview).
