#!/usr/bin/env python3
"""
Test script demonstrating the enhanced pretty output for Hypha service

This script shows how the Claude Agent Manager service outputs are formatted
with emojis for better readability.
"""

import asyncio
from hypha_rpc import connect_to_server

def format_message(update):
    """Format Claude messages with emojis for better readability"""
    if update["type"] == "stream":
        data = update.get("data", {})
        
        # Handle agent messages
        if data.get("type") == "agent":
            agent_data = data.get("data", {})
            msg_type = agent_data.get("type")
            
            if msg_type == "system":
                subtype = agent_data.get("subtype", "")
                if subtype == "init":
                    tools = agent_data.get("tools", [])
                    return f"⚙️  System initialized\n    📁 Working dir: {agent_data.get('cwd', 'N/A')}\n    🔧 Tools: {len(tools)} available"
                return f"ℹ️  System: {subtype}"
                
            elif msg_type == "assistant":
                message = agent_data.get("message", {})
                content = message.get("content", [])
                for item in content:
                    if item.get("type") == "text":
                        return f"💬 Assistant: {item.get('text', '')}"
                    elif item.get("type") == "tool_use":
                        tool_name = item.get("name", "unknown")
                        tool_icon = get_tool_icon(tool_name)
                        return f"{tool_icon} Using tool: {tool_name}"
                        
            elif msg_type == "result":
                subtype = agent_data.get("subtype", "")
                if subtype == "success":
                    result = agent_data.get("result", "Completed")
                    usage = agent_data.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)
                    cost = agent_data.get("total_cost_usd", 0)
                    return f"✅ Success: {result}\n    📊 Tokens: {input_tokens} in, {output_tokens} out\n    💰 Cost: ${cost:.6f}"
                elif subtype == "error":
                    return f"❌ Error: {agent_data.get('error', 'Unknown error')}"
                    
            elif msg_type == "user":
                # Tool results
                message = agent_data.get("message", {})
                content = message.get("content", [])
                for item in content:
                    if item.get("type") == "tool_result":
                        # Truncate long results
                        result_content = item.get("content", "")
                        if len(result_content) > 200:
                            result_content = result_content[:200] + "..."
                        return f"📊 Tool result: {result_content}"
                        
    elif update["type"] == "permission":
        req = update.get("permissionRequest", {})
        tool = req.get("toolName", "unknown")
        patterns = req.get("patterns", [])
        return f"🔐 Permission requested\n    Tool: {tool}\n    Patterns: {', '.join(patterns)}"
        
    elif update["type"] == "error":
        return f"❌ Error: {update.get('error', 'Unknown error')}"
        
    elif update["type"] == "done":
        return "✅ Execution completed successfully"
        
    elif update["type"] == "aborted":
        return "⚠️  Execution aborted"
        
    # Don't show raw messages by default
    return None

def get_tool_icon(tool_name):
    """Get icon for different tools"""
    icons = {
        'Task': '🎯',
        'Bash': '💻',
        'Read': '📖',
        'Write': '✍️',
        'Edit': '✏️',
        'MultiEdit': '📝',
        'Glob': '🔍',
        'Grep': '🔎',
        'LS': '📂',
        'WebFetch': '🌐',
        'WebSearch': '🔍',
        'TodoWrite': '📋',
        'NotebookEdit': '📓',
        'ExitPlanMode': '🚪',
        'BashOutput': '📊',
        'KillBash': '🛑'
    }
    
    if 'mcp__' in tool_name:
        return '🔌'
    return icons.get(tool_name, '🔧')

async def main():
    print("=" * 60)
    print("🎯 Claude Agent Manager - Pretty Output Demo")
    print("=" * 60)
    print()
    
    try:
        # Connect to Hypha
        print("🔌 Connecting to Hypha server...")
        async with connect_to_server({"server_url": "https://hypha.aicell.io"}) as server:
            print(f"✅ Connected to workspace: {server.config.workspace}")
            print()
            
            # Get the service
            print("🔍 Looking for Claude Agent Manager service...")
            service = await server.get_service("claude-agent-manager")
            print("✅ Service found!")
            print()
            
            # Create an agent with bypassPermissions mode (now the default)
            print("🤖 Creating agent...")
            agent = await service.createAgent({
                "name": "DemoAgent",
                "description": "Agent for demonstrating pretty output"
            })
            
            print(f"✅ Agent created!")
            print(f"   Name: {agent['name']}")
            print(f"   ID: {agent['id']}")
            print(f"   Mode: {agent.get('permissionMode', 'bypassPermissions')}")
            print(f"   Directory: {agent['workingDirectory']}")
            print()
            
            # Execute a command with streaming
            print("📝 Executing command: 'List files and create a demo file'")
            print("-" * 60)
            
            generator = await service.executeStreaming({
                "agentId": agent["id"],
                "prompt": "List the files in the current directory, then create a file called demo.txt with the content 'Hello from Hypha!'"
            })
            
            # Process the stream with pretty formatting
            async for update in generator:
                formatted = format_message(update)
                if formatted:
                    print(formatted)
                    
                # Handle permission requests (won't happen with bypassPermissions)
                if update["type"] == "permission":
                    print("  ➡️  Auto-approving permission...")
                    await service.respondToPermission({
                        "requestId": update["permissionRequest"]["id"],
                        "action": "allow"
                    })
            
            print("-" * 60)
            print()
            
            # Clean up
            print("🧹 Cleaning up...")
            removed = await service.removeAgent(agent["id"])
            if removed:
                print("✅ Agent removed successfully")
            else:
                print("⚠️  Failed to remove agent")
                
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Make sure the Hypha service is running:")
        print("   ./start-hypha-service.sh")
    
    print()
    print("=" * 60)
    print("✅ Demo completed!")

if __name__ == "__main__":
    asyncio.run(main())