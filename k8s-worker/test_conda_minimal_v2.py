#!/usr/bin/env python3
"""
Minimal test to verify Conda worker can start without mamba permission errors.
"""
import asyncio
import os
import sys
from hypha_rpc import connect_to_server

async def test_conda_worker():
    """Test that conda worker can start and register successfully."""

    # Configuration
    server_url = "https://hypha.aicell.io"
    workspace = "hypha-agents"
    token = os.environ.get("HYPHA_TOKEN")

    if not token:
        print("❌ ERROR: HYPHA_TOKEN environment variable not set")
        sys.exit(1)

    print("=" * 80)
    print("MINIMAL CONDA WORKER TEST - v2")
    print("=" * 80)
    print(f"Server: {server_url}")
    print(f"Workspace: {workspace}")
    print("=" * 80)

    try:
        # Step 1: Connect to Hypha
        print("\n1. Connecting to Hypha server...")
        server = await connect_to_server(
            server_url=server_url,
            workspace=workspace,
            token=token,
        )
        print(f"✅ Connected to workspace: {workspace}")

        # Step 2: Get k8s-worker service
        print("\n2. Getting k8s-worker service...")
        worker = await server.get_service("*:k8s-worker")
        print(f"✅ Got k8s-worker service")

        # Step 3: Start a conda worker job
        import time
        session_id = f"test-conda-minimal-{int(time.time())}"
        print(f"\n3. Starting Conda worker job...")
        print(f"   Session ID: {session_id}")

        # Don't specify service_id - let it generate a random one
        # Enable wait_for_service so k8s.py will wait for the service to register
        job_id = await worker.start({
            "id": session_id,
            "app_id": "test-conda-minimal",
            "workspace": workspace,
            "client_id": "test-conda-client",
            "server_url": server_url,
            "artifact_id": "test-conda-artifact",
            "manifest": {
                "type": "conda-worker",
                # Don't specify service_id - let k8s.py generate a random one
                "workspace": workspace,
                "wait_for_service": True,  # Wait for service to be registered
                "verbose": True,
                "image": "oeway/hypha-conda-worker:0.1.0",  # Use the new image with micromamba
            }
        })
        print(f"✅ Job started: {job_id}")
        print(f"   k8s.py has already waited for the pod to start and service to register")

        # Step 4: Get logs to see if there are any errors
        print(f"\n4. Getting job logs (checking for mamba errors)...")
        logs = await worker.get_logs(session_id)
        print(f"   Retrieved {logs.get('total', 0)} log entries")

        # Check for permission errors in logs
        has_permission_error = False
        has_podsecurity_error = False
        for log in logs.get("items", []):
            log_msg = log.get("content", "")
            print(f"   LOG [{log.get('type', 'unknown')}]: {log_msg[:200]}")
            if 'Permission denied' in log_msg and 'mamba' in log_msg:
                has_permission_error = True
                print(f"   ❌ FOUND MAMBA PERMISSION ERROR")
            if 'violates PodSecurity' in log_msg:
                has_podsecurity_error = True
                print(f"   ❌ FOUND PODSECURITY ERROR")

        if not has_permission_error and not has_podsecurity_error:
            print(f"   ✅ No mamba permission errors or PodSecurity violations found in logs")

        # Step 5: Stop the job
        print(f"\n5. Stopping job...")
        try:
            await worker.stop(session_id)
            print(f"✅ Job stopped")
        except Exception as e:
            print(f"⚠️  Could not stop job: {e}")

        # Final verdict
        print("\n" + "=" * 80)
        if has_permission_error:
            print("❌ TEST FAILED: Mamba permission errors detected")
            print("   The conda worker image still has mamba permission issues")
            sys.exit(1)
        elif has_podsecurity_error:
            print("❌ TEST FAILED: PodSecurity violations detected")
            print("   The pods are still being blocked by security policies")
            sys.exit(1)
        else:
            print("✅ TEST PASSED: No mamba permission errors or PodSecurity violations")
            print("   The conda worker can start without permission issues")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_conda_worker())
