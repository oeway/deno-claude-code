#!/usr/bin/env python3
"""
Remote test for Claude Agent Manager via Hypha
Simple test similar to test_local.ts but calling the remote Hypha service

Usage:
    python test_remote.py
"""

import asyncio
import os
from hypha_rpc import connect_to_server, login
from dotenv import load_dotenv

load_dotenv()


async def main():
    print("🧪 Testing Claude Agent Manager Remotely\n")

    server_url = "https://hypha.aicell.io"

    # Step 1: Connect to server
    print("1. Connecting to Hypha server...")
    token = os.environ.get("HYPHA_TOKEN") or await login({"server_url": server_url})
    server = await connect_to_server({
        "server_url": server_url,
        "workspace": "ws-user-github|478667",
        "token": token
    })
    print(f"✅ Connected! Workspace: {server.config.workspace}\n")

    try:
        # Step 2: Get the service
        print("2. Getting claude-agents service...")
        service = await server.get_service("claude-agents")
        print("✅ Service found\n")

        # Step 3: Create an agent
        print("3. Creating agent...")
        agent = await service.createAgent({
            "name": "TestAgent",
            "permissionMode": "bypassPermissions",
        })
        agent_id = agent['id']
        print(f"✅ Agent created: {agent_id}\n")

        # Step 4: Test simple execution
        print("4. Testing simple command execution...")
        print("Prompt: What is 2 + 2?\n")

        stream = await service.executeStreaming({
            "agentId": agent_id,
            "prompt": "What is 2 + 2?",
        })

        message_count = 0
        async for update in stream:
            message_count += 1

            # Display formatted messages
            if 'display_message' in update and update['display_message']:
                print(f"   [{message_count}] {update['display_message']}")

            # Handle terminal states
            if update['type'] == 'error':
                print(f"   ❌ Error: {update.get('error', 'Unknown error')}")
                break
            elif update['type'] == 'done':
                print("   ✅ Execution completed")
                break
            elif update['type'] == 'aborted':
                print("   ⚠️  Execution aborted")
                break

        print(f"\n   Total messages: {message_count}")

        # Step 5: Cleanup
        print("\n5. Cleaning up...")
        removed = await service.removeAgent(agent_id)
        if removed:
            print("✅ Agent removed")
        else:
            print("❌ Failed to remove agent")

        print("\n🎉 Test completed successfully!")

    finally:
        await server.disconnect()
        print("👋 Disconnected from server")


if __name__ == "__main__":
    asyncio.run(main())
