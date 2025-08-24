#!/usr/bin/env -S deno run --allow-all

/**
 * Quick test to create agent and send test message
 */

const API_BASE = "http://localhost:8000/api";

async function quickTest() {
  console.log("🚀 Quick Rich UI Test\n");
  
  // Create an agent
  console.log("1. Creating test agent...");
  const createResp = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workingDirectory: "/tmp/test-agent-" + Date.now()
    })
  });
  
  const agent = await createResp.json();
  console.log(`   ✅ Agent created: ${agent.id}\n`);
  
  // Send a simple test message
  console.log("2. Sending test message...");
  const message = "What is 2+2?";
  
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: agent.id, message })
  });
  
  if (!response.ok) {
    console.error(`❌ Failed: ${response.status}`);
    return;
  }
  
  console.log("   ✅ Message sent, streaming response...\n");
  
  const reader = response.body?.getReader();
  if (!reader) return;
  
  const decoder = new TextDecoder();
  let buffer = "";
  
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
          if (data.type === 'done') {
            console.log("\n✅ Complete!");
            console.log(`\n📝 Visit http://localhost:8000 to see the rich UI`);
            console.log(`   Your agent ID: ${agent.id}`);
            return;
          }
        } catch {}
      }
    }
  }
}

quickTest().catch(console.error);