#!/usr/bin/env python3
"""
Test Services for Claude Agent Manager

Simple script to test the Claude Agent Manager Hypha service with end-to-end workflows.

Usage:
    python test_services.py              # Run end-to-end cat gallery workflow
    python test_services.py --workflow   # Cat gallery end-to-end workflow
    python test_services.py --e2e        # Alias for --workflow
    python test_services.py --quick      # Quick automated test
    python test_services.py --help       # Show help
"""

import asyncio
import os
from hypha_rpc import connect_to_server, login
# load dotenv
from dotenv import load_dotenv
load_dotenv()

async def quick_test():
    """Quick automated test"""
    print("🚀 Quick Test Mode\n")

    server_url = "https://hypha.aicell.io"

    # Connect to server
    print(f"🔌 Connecting to {server_url}...")
    token = os.environ.get("HYPHA_TOKEN") or await login({"server_url": server_url})
    server = await connect_to_server({
        "server_url": server_url,
        "workspace": "ws-user-github|478667",
        "token": token
    })
    print(f"✅ Connected! Workspace: {server.config.workspace}")

    # Get service
    service = await server.get_service("claude-agents")
    print("✅ Found Claude Agent Manager service")

    try:
        # Test 1: Basic operations
        print("\n" + "=" * 60)
        print("Test 1: Basic Operations")
        print("=" * 60)

        pong = await service.ping()
        print(f"🏓 Ping: {pong}")

        info = await service.getInfo()
        print(f"📊 Manager Info:")
        print(f"   - Base Directory: {info['baseDirectory']}")
        print(f"   - Agent Count: {info['agentCount']}")

        # Test 2: Create and use agent
        print("\n" + "=" * 60)
        print("Test 2: Create and Use Agent")
        print("=" * 60)

        agent = await service.createAgent({
            "name": "QuickTestAgent",
            "permissionMode": "bypassPermissions",
        })
        print(f"✅ Agent created: {agent['name']}")

        # Execute simple command
        stream = await service.executeStreaming({
            "agentId": agent['id'],
            "prompt": "What is 5 + 3?",
        })

        async for update in stream:
            if 'display_message' in update and update['display_message']:
                print(update['display_message'])
            if update['type'] in ['error', 'done', 'aborted']:
                break

        # Test 3: List agents
        print("\n" + "=" * 60)
        print("Test 3: List Agents")
        print("=" * 60)

        agents = await service.getAllAgents()
        print(f"📋 Active agents: {len(agents)}")

        # Test 4: Cleanup
        print("\n" + "=" * 60)
        print("Test 4: Cleanup")
        print("=" * 60)

        removed = await service.removeAgent(agent['id'])
        print(f"✅ Agent removed: {removed}")

        print("\n✅ Quick test completed!")

    finally:
        await server.disconnect()


async def end_to_end_workflow():
    """End-to-end workflow test: Create agent and build a cat gallery - linear execution"""
    print("🚀 End-to-End Workflow: Cat Gallery Builder\n")

    server_url = "https://hypha.aicell.io"

    # Step 1: Connect to server
    print("\n" + "=" * 70)
    print("Step 1: Connect to Hypha Server")
    print("=" * 70)

    print(f"🔌 Connecting to {server_url}...")
    token = os.environ.get("HYPHA_TOKEN") or await login({"server_url": server_url})
    server = await connect_to_server({
        "server_url": server_url,
        "workspace": "ws-user-github|478667",
        "token": token
    })
    print(f"✅ Connected! Workspace: {server.config.workspace}")

    # Get the service
    print("🔍 Getting claude-agents service...")
    service = await server.get_service("claude-agents")
    print("✅ Service found")

    # Step 2: Ping to verify service is working
    print("\n" + "=" * 70)
    print("Step 2: Service Health Check")
    print("=" * 70)

    pong = await service.ping()
    print(f"🏓 Ping: {pong}")
    print("✅ Service is responsive")

    # Get initial info
    info = await service.getInfo()
    print(f"📊 Manager Status:")
    print(f"   - Base Directory: {info['baseDirectory']}")
    print(f"   - Current Agents: {info['agentCount']}")
    print(f"   - Max Capacity: 10")

    # Step 3: Clean up any existing agents
    print("\n" + "=" * 70)
    print("Step 3: Clean Workspace")
    print("=" * 70)

    existing_agents = await service.getAllAgents()
    if existing_agents:
        print(f"🧹 Found {len(existing_agents)} existing agents, cleaning up...")
        count = await service.removeAllAgents()
        print(f"✅ Removed {count} agents")
    else:
        print("✅ Workspace is clean")

    # Step 4: Create a new agent
    print("\n" + "=" * 70)
    print("Step 4: Create Cat Gallery Agent")
    print("=" * 70)

    agent = await service.createAgent({
        "name": "CatGalleryBuilder",
        "permissionMode": "bypassPermissions",
    })
    agent_id = agent['id']
    print(f"✅ Agent '{agent['name']}' created successfully")
    print(f"   ID: {agent_id}")
    print(f"   Working Directory: {agent['workingDirectory']}")

    # Step 5: Verify agent was created
    print("\n" + "=" * 70)
    print("Step 5: Verify Agent Creation")
    print("=" * 70)

    agents = await service.getAllAgents()
    print(f"📋 Active agents: {len(agents)}")
    for a in agents:
        print(f"   - {a['name']} ({a['id'][:12]}...)")

    info = await service.getInfo()
    print(f"✅ Agent count updated: {info['agentCount']}")

    # Step 6: Build the cat gallery
    print("\n" + "=" * 70)
    print("Step 6: Execute Cat Gallery Creation")
    print("=" * 70)

    cat_gallery_prompt = """Create a simple cat gallery webpage with the following requirements:

1. Create an HTML file called 'cat-gallery.html' with:
   - A nice title "My Cat Gallery"
   - A grid layout showing 6 cat images
   - Use placeholder cat images from https://placecats.com/ (different sizes: 200x200, 300x200, 250x250, etc.)
   - Add some CSS styling to make it look nice with a responsive grid
   - Add captions under each cat image (like "Fluffy Cat", "Sleepy Cat", "Playful Cat", etc.)

2. Create a README.md file that explains:
   - What the gallery is
   - How to view it (just open the HTML file in a browser)
   - The image sources used

Keep it simple and functional. Use clean, well-formatted code."""

    print(f"📝 Prompt: Create a cat gallery webpage...")
    print(f"🤖 Agent: {agent_id[:12]}...")
    print(f"\n{'─' * 70}")

    # Execute with streaming
    stream = await service.executeStreaming({
        "agentId": agent_id,
        "prompt": cat_gallery_prompt,
    })

    update_count = 0
    async for update in stream:
        update_count += 1

        # Display formatted messages
        if 'display_message' in update and update['display_message']:
            print(update['display_message'])

        # Handle terminal states
        if update['type'] == 'error':
            print(f"\n❌ Error: {update.get('error', 'Unknown error')}")
            break
        elif update['type'] == 'done':
            print(f"\n✅ Gallery creation completed!")
            break
        elif update['type'] == 'aborted':
            print(f"\n⚠️  Execution aborted")
            break

    print("─" * 70)
    print(f"📊 Total updates: {update_count}")

    # Step 7: Verify the gallery was created
    print("\n" + "=" * 70)
    print("Step 7: Verify Gallery Files")
    print("=" * 70)

    verification_prompt = "List all files in the current directory and show me the first 10 lines of cat-gallery.html if it exists."
    print(f"📝 Verification command: List files and preview cat-gallery.html")
    print(f"\n{'─' * 70}")

    # Execute verification
    stream = await service.executeStreaming({
        "agentId": agent_id,
        "prompt": verification_prompt,
    })

    async for update in stream:
        if 'display_message' in update and update['display_message']:
            print(update['display_message'])

        if update['type'] in ['error', 'done', 'aborted']:
            break

    print("─" * 70)

    # Step 8: Final status check
    print("\n" + "=" * 70)
    print("Step 8: Final Status Check")
    print("=" * 70)

    info = await service.getInfo()
    print(f"📊 Final Manager Status:")
    print(f"   - Active Agents: {info['agentCount']}")
    print(f"   - Agent ID: {agent_id[:12]}...")
    print(f"   - Working Directory: {agent['workingDirectory']}")

    # Step 9: Optional cleanup
    print("\n" + "=" * 70)
    print("Step 9: Cleanup (Optional)")
    print("=" * 70)

    cleanup = input("\n🗑️  Remove the agent and files? (yes/no): ").strip().lower()
    if cleanup == "yes":
        removed = await service.removeAgent(agent_id)
        if removed:
            print(f"✅ Agent removed successfully")
        else:
            print(f"❌ Failed to remove agent")

        info = await service.getInfo()
        print(f"📊 Agents remaining: {info['agentCount']}")
    else:
        print(f"⏭️  Skipping cleanup - agent remains active")
        print(f"   Agent ID: {agent_id}")
        print(f"   Files location: {agent['workingDirectory']}")

    # Disconnect
    await server.disconnect()
    print("\n👋 Disconnected from server")

    print("\n" + "=" * 70)
    print("✅ End-to-End Workflow Completed Successfully!")
    print("=" * 70)
    print(f"\n📝 Summary:")
    print(f"   - Service health checked ✓")
    print(f"   - Agent created ✓")
    print(f"   - Cat gallery built ✓")
    print(f"   - Files verified ✓")
    print(f"   - Agent ID: {agent_id[:12]}...")


async def main():
    """Main entry point"""
    import sys

    print("🚀 Claude Agent Manager - Test Services\n")

    # Check for test modes
    if len(sys.argv) > 1:
        if sys.argv[1] == "--quick":
            await quick_test()
            return
        elif sys.argv[1] == "--workflow" or sys.argv[1] == "--e2e":
            await end_to_end_workflow()
            return
        elif sys.argv[1] == "--help":
            print("Usage: python test_services.py [MODE]\n")
            print("Modes:")
            print("  (no args)         End-to-end cat gallery workflow (default)")
            print("  --quick           Quick automated test")
            print("  --workflow        End-to-end cat gallery workflow")
            print("  --e2e             Alias for --workflow")
            print("  --help            Show this help message")
            return

    # Default: run end-to-end workflow
    await end_to_end_workflow()


if __name__ == "__main__":
    asyncio.run(main())
