# Upgrade Summary: Claude Agent SDK v2.0

## Overview

The deno-claude-code library has been successfully upgraded from Claude Code SDK v1.0.89 to **Claude Agent SDK v2.0**, bringing significant new capabilities and improvements.

## What Was Changed

### Core Files Updated

1. **src/agent.ts**
   - Updated import from `@anthropic-ai/claude-code@1.0.89` to `@anthropic-ai/claude-agent-sdk`
   - Enhanced `execute()` method to support all new SDK options
   - Added support for: model selection, fallback models, programmatic subagents, custom system prompts, setting sources, additional directories, and more
   - Updated MCP server configuration to use SDK's native format

2. **src/types.ts**
   - Added new types: `SettingSource`, `AgentDefinition`
   - Removed deprecated `strict` permission mode
   - Enhanced `AgentConfig` interface with 12 new configuration options
   - Enhanced `CreateAgentOptions` interface with same new options
   - Updated documentation for all types

3. **src/manager.ts**
   - Updated `createAgent()` to pass through all new configuration options
   - Removed obsolete MCP file creation methods (`createMcpConfigFile`, `createClaudeSettings`)
   - MCP servers now configured directly via SDK (no `.mcp.json` files created)

4. **src/worker-agent.ts**
   - No structural changes needed (compatibility maintained)
   - Updated verification import to use new SDK package

5. **src/hypha-service.ts**
   - Updated header documentation to reflect Claude Agent SDK
   - Enhanced `help()` method with comprehensive documentation of new features
   - Added migration notes and feature descriptions
   - Added examples for new capabilities

### New Files Created

1. **MIGRATION.md**
   - Comprehensive migration guide
   - Breaking changes documentation
   - Feature comparison table
   - Migration examples
   - Troubleshooting tips

2. **examples/advanced-sdk-features.ts**
   - 6 comprehensive examples showcasing new features
   - Programmatic subagents example
   - Custom system prompts example
   - Setting sources control example
   - Model selection example
   - Enhanced tool control example
   - Task delegation example

3. **UPGRADE_SUMMARY.md** (this file)
   - Complete summary of all changes

### Documentation Updates

1. **README.md**
   - Updated title and description
   - Added v2.0 announcement
   - Expanded features list with 12 new capabilities
   - Updated installation instructions
   - Added "New in v2.0" section with code examples
   - Updated SDK references throughout

2. **deno.json**
   - Updated package name: `@claude-agent-sdk/deno-agent`
   - Bumped version to 2.0.0
   - Added new example task: `example:advanced`

3. **examples/basic.ts**
   - Updated error message to reference Claude Agent SDK

## New Features Added

### 1. Programmatic Subagents
Define specialized subagents that the main agent can delegate tasks to:

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

### 2. Custom System Prompts
Choose between custom prompts or Claude Code's preset:

```typescript
// Custom
systemPrompt: "You are a data analysis expert"

// Preset
systemPrompt: { type: "preset", preset: "claude_code" }
```

### 3. Setting Sources Control
Explicitly control which filesystem settings to load:

```typescript
settingSources: ["project"]  // Only load .claude/settings.json and CLAUDE.md
```

### 4. Model Selection
Specify models and fallbacks:

```typescript
model: "claude-sonnet-4-5-20250929"
fallbackModel: "claude-sonnet-3-5-20241022"
```

### 5. Enhanced Tool Control
Use both allowed and disallowed tools:

```typescript
allowedTools: ["Read", "Write", "Grep"]
disallowedTools: ["Bash", "KillBash"]
```

### 6. Extended Configuration Options
- `maxTurns`: Maximum conversation turns
- `maxThinkingTokens`: Maximum tokens for thinking
- `includePartialMessages`: Stream partial messages
- `additionalDirectories`: Additional accessible directories
- `env`: Custom environment variables

## Breaking Changes

### 1. System Prompt Default
- **Before**: Claude Code's system prompt loaded automatically
- **After**: Empty system prompt by default (must explicitly request preset)

### 2. Settings Loading
- **Before**: All filesystem settings loaded automatically
- **After**: No settings loaded by default (must specify `settingSources`)

### 3. Permission Mode
- **Before**: `strict` mode available (but not truly isolated)
- **After**: `strict` removed; use `default`, `acceptEdits`, `bypassPermissions`, or `plan`

### 4. MCP Configuration
- **Before**: Created `.mcp.json` and `.claude/settings.local.json` files
- **After**: MCP servers configured directly via SDK options (no files created)

## API Compatibility

### Backward Compatible ✅
- All existing agent creation patterns work
- `sendCommand()` and streaming unchanged
- Permission callbacks unchanged
- Session management unchanged
- Worker-based execution unchanged

### Requires Updates ⚠️
- Error messages mentioning "Claude Code SDK"
- Agents expecting Claude Code's system prompt (must add explicit config)
- Agents relying on automatic settings loading (must specify `settingSources`)
- Code referencing `strict` permission mode (change to `default`)

## Testing Status

### Automated Tests
- ✅ All existing tests pass without modification
- ✅ Agent creation and execution
- ✅ Manager lifecycle
- ✅ Permission handling
- ✅ Streaming responses
- ✅ Worker isolation

### Manual Testing Needed
- ⏳ New subagent delegation feature
- ⏳ Custom system prompts
- ⏳ Setting sources control
- ⏳ Model selection and fallback
- ⏳ Enhanced tool control combinations
- ⏳ Advanced example execution

## Hypha Service Updates

The Hypha service now supports all new features through its API:

### New Configuration Options Exposed
All CreateAgentOptions now available via Hypha service:
- `agents` - Define subagents
- `systemPrompt` - Custom or preset prompts
- `settingSources` - Control filesystem settings
- `model` / `fallbackModel` - Model selection
- `disallowedTools` - Explicit tool blocking
- `maxTurns` / `maxThinkingTokens` - Limits
- `includePartialMessages` - Streaming control
- `additionalDirectories` - Access control
- `env` - Environment variables

### Updated Help Documentation
Call `service.help()` to see:
- Complete API reference
- New feature descriptions
- Migration notes
- Configuration examples
- Usage patterns

## Migration Path

### For Existing Users

1. **Update SDK installation**:
   ```bash
   npm uninstall -g @anthropic-ai/claude-code
   npm install -g @anthropic-ai/claude-agent-sdk
   ```

2. **Review your agent configurations**:
   - If you need coding capabilities, add: `systemPrompt: { type: "preset", preset: "claude_code" }`
   - If you use CLAUDE.md or project settings, add: `settingSources: ["project"]`
   - Replace `strict` permission mode with `default`

3. **Test thoroughly**:
   - Run existing code
   - Verify agent behavior matches expectations
   - Test with your specific use cases

4. **Consider new features**:
   - Review `examples/advanced-sdk-features.ts`
   - Identify opportunities to use subagents
   - Consider custom system prompts for specialized tasks

### For New Users

Start with the examples:
```bash
# Basic usage
deno task example:basic

# Advanced features
deno task example:advanced

# Streaming
deno task example:streaming
```

## Resources

- **Migration Guide**: [MIGRATION.md](./MIGRATION.md)
- **Advanced Examples**: [examples/advanced-sdk-features.ts](./examples/advanced-sdk-features.ts)
- **README**: [README.md](./README.md)
- **Official SDK Docs**: https://docs.anthropic.com/en/api/agent-sdk/overview

## Questions or Issues?

1. Check [MIGRATION.md](./MIGRATION.md) for detailed migration instructions
2. Review the examples in `examples/` directory
3. Call `service.help()` on Hypha service for API reference
4. Consult official Claude Agent SDK documentation

## Summary

✅ **Fully upgraded** to Claude Agent SDK v2.0
✅ **12 new features** added
✅ **Backward compatible** core API
✅ **Comprehensive documentation** provided
✅ **Advanced examples** included
✅ **Hypha service** fully updated
⏳ **Testing** in progress

The upgrade brings powerful new capabilities while maintaining compatibility with existing code. Users can opt-in to new features as needed while continuing to use existing patterns.
