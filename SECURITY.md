# Security Considerations

## Important Security Warning

**The Claude Code SDK fundamentally requires the ability to execute shell commands, which breaks file system isolation.**

## The Problem

While Deno provides excellent sandboxing capabilities through its permission system, the Claude Code SDK needs to:
1. Spawn a Node.js process to run its CLI
2. Execute shell commands via its `Bash` tool

When we grant `run` permission (even restricted to specific commands), the Claude Code SDK can:
- Use its `Bash` tool to execute ANY shell command
- These shell commands run with the full permissions of the user
- This completely bypasses Deno's file system sandbox

## Example Security Issue

Even with Deno permissions restricted to a specific directory:
```typescript
permissions = {
  read: ["./workspace"],  // Only read workspace
  write: ["./workspace"], // Only write to workspace
  run: true,             // But this allows shell commands!
}
```

Claude can still:
- Run `ls ~` to list your home directory
- Run `cat /etc/passwd` to read system files
- Run `rm -rf /` (if the user has permissions)

## Permission Modes

### `bypassPermissions` Mode
- **Full system access**
- No sandboxing at all
- Use only for trusted operations

### `default` Mode  
- **File system sandbox at Deno level**
- **BUT: Shell commands can bypass the sandbox**
- Claude's `Bash` tool has full system access
- ⚠️ **Security Risk**: Can access any file via shell commands

### `strict` Mode (Limited Support)
- **Intended for true isolation**
- Would disable all shell commands
- **Problem**: Claude Code SDK won't function without `run` permission
- Currently falls back to allowing only `node` command
- ⚠️ **Still a security risk**: Node process can access entire file system

## Recommendations

1. **For Development/Testing**: Use `default` mode but be aware of the risks
2. **For Production**: Do NOT use this in production with untrusted inputs
3. **For True Isolation**: Would need to:
   - Fork and modify Claude Code SDK to remove shell command functionality
   - Or implement a custom command filter/proxy
   - Or use a different AI assistant that doesn't require shell access

## Alternative Approaches

If you need true isolation:

1. **Container/VM Isolation**: Run each agent in a Docker container or VM
2. **System-level Sandboxing**: Use OS-level sandboxing (AppArmor, SELinux, etc.)
3. **Custom Claude SDK**: Modify the SDK to remove shell command capabilities
4. **Different AI Tool**: Use an AI assistant designed for sandboxed environments

## Current Implementation

The current implementation provides:
- ✅ Process isolation (each agent in its own worker)
- ✅ Memory isolation between agents
- ⚠️ Limited file system isolation (can be bypassed via shell)
- ❌ No true command execution isolation

## Conclusion

**The Claude Code SDK is designed as a development assistant with full system access. It is not suitable for running untrusted code or in production environments where security isolation is critical.**

For true security isolation, you would need to either:
1. Modify the Claude Code SDK to remove shell capabilities
2. Use system-level isolation (containers, VMs)
3. Use a different AI tool designed for sandboxed execution