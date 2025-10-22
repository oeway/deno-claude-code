#!/usr/bin/env -S deno run --allow-all

/**
 * Manual test script to verify rich UI rendering
 * Run this while the web UI is running to see all message types
 */

const API_BASE = "http://localhost:8000/api";

async function testRichRendering() {
  console.log("🧪 Testing Rich UI Message Rendering\n");
  console.log("📝 Open http://localhost:8000 in your browser to see the rich UI\n");
  
  // Get existing agents
  const agentsResp = await fetch(`${API_BASE}/agents`);
  const agents = await agentsResp.json();
  
  if (agents.length === 0) {
    console.log("❌ No agents found. Please create an agent in the UI first.");
    return;
  }
  
  const agentId = agents[0].id;
  console.log(`✅ Found agent: ${agentId}\n`);
  
  // Test message that will trigger various rich components
  const testMessage = `Please do the following tasks:
1. Create a todo list for building a simple web app
2. Show me the current directory with ls
3. Create a test file called hello.txt with "Hello World" 
4. Read the file back to verify it was created
5. Search for any .ts files in the current directory
6. Tell me what 2+2 equals`;

  console.log("📤 Sending test message to trigger rich UI components...\n");
  
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, message: testMessage })
  });
  
  if (!response.ok) {
    console.error(`❌ Failed to send message: ${response.status}`);
    return;
  }
  
  const reader = response.body?.getReader();
  if (!reader) return;
  
  const decoder = new TextDecoder();
  let buffer = "";
  const messageTypes = new Set<string>();
  
  console.log("📥 Receiving responses:\n");
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value);
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === 'agent') {
            const claudeData = data.data;
            messageTypes.add(claudeData.type);
            
            switch (claudeData.type) {
              case 'system':
                if (claudeData.subtype === 'init') {
                  console.log("  ✅ System initialization (with session details)");
                } else {
                  console.log(`  ✅ System message: ${claudeData.subtype}`);
                }
                break;
              case 'tool_use':
                console.log(`  ✅ Tool use: ${claudeData.tool_name || claudeData.name} (with parameters)`);
                break;
              case 'tool_result':
                console.log("  ✅ Tool result (with output)");
                break;
              case 'todos':
                console.log(`  ✅ Todo list (${claudeData.todos?.length || 0} items with status icons)`);
                break;
              case 'assistant':
                console.log("  ✅ Assistant message");
                break;
              case 'user_feedback':
                console.log("  ✅ User feedback");
                break;
              case 'error':
                console.log("  ✅ Error message");
                break;
            }
          } else if (data.type === 'done') {
            console.log("\n  ✅ Execution complete");
          } else if (data.type === 'error') {
            console.log(`\n  ⚠️ Error: ${data.error}`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
  
  console.log("\n📊 Summary of rendered message types:");
  console.log(`   Total unique types: ${messageTypes.size}`);
  messageTypes.forEach(type => console.log(`   - ${type}`));
  
  console.log("\n🎉 Test complete! Check the browser to see:");
  console.log("   • Rich graphical components for each message type");
  console.log("   • Tool executions with parameter display");
  console.log("   • Todo lists with status tracking");
  console.log("   • System initialization details");
  console.log("   • Spinner during processing (removed when content arrives)");
  console.log("   • Color-coded message types with icons");
}

if (import.meta.main) {
  testRichRendering().catch(console.error);
}