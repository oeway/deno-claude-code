/**
 * Claude CLI wrapper for Deno
 * Executes the Claude Code CLI as a child process
 */

export interface QueryOptions {
  prompt: string;
  options?: {
    abortController?: AbortController;
    cwd?: string;
    permissionMode?: string;
    resume?: string;
    allowedTools?: string[];
  };
}

/**
 * Execute Claude CLI and stream the output
 */
export async function* query(params: QueryOptions): AsyncGenerator<any> {
  const { prompt, options = {} } = params;
  
  // Build CLI command arguments
  const args: string[] = ["./node_modules/.deno/@anthropic-ai+claude-code@2.0.25/node_modules/@anthropic-ai/claude-code/cli.js"];
  
  if (options.permissionMode) {
    args.push(`--permission-mode=${options.permissionMode}`);
  }
  
  if (options.resume) {
    args.push(`--resume=${options.resume}`);
  }
  
  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push(`--allowed-tools=${options.allowedTools.join(',')}`);
  }
  
  // Create the process
  const command = new Deno.Command("node", {
    args,
    cwd: options.cwd || Deno.cwd(),
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  
  const process = command.spawn();
  
  // Handle abort signal
  if (options.abortController) {
    options.abortController.signal.addEventListener("abort", () => {
      process.kill();
    });
  }
  
  // Write the prompt to stdin
  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(prompt));
  await writer.close();
  
  // Read output line by line
  const decoder = new TextDecoder();
  const reader = process.stdout.getReader();
  
  let buffer = "";
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            // Try to parse as JSON (Claude CLI outputs JSON messages)
            const message = JSON.parse(line);
            yield message;
          } catch {
            // If not JSON, yield as text message
            yield { type: "text", content: line };
          }
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const message = JSON.parse(buffer);
        yield message;
      } catch {
        yield { type: "text", content: buffer };
      }
    }
  } finally {
    reader.releaseLock();
    
    // Wait for process to complete
    const status = await process.status;
    
    if (!status.success) {
      const errorReader = process.stderr.getReader();
      const { value } = await errorReader.read();
      errorReader.releaseLock();
      
      if (value) {
        const errorMessage = decoder.decode(value);
        throw new Error(`Claude CLI error: ${errorMessage}`);
      }
    }
  }
}