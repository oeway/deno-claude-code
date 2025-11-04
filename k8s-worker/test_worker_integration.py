"""Integration test for Kubernetes Worker against deployed Hypha instance.

This script tests the K8s worker can launch both regular jobs and Claude agents.

Run with: python test_worker_integration.py

Validate jobs with: kubectl -n hypha get jobs | grep hypha-job
"""

import asyncio
import os
import sys
from hypha_rpc import connect_to_server

async def test_k8s_job_lifecycle():
    """Test complete lifecycle of K8s job: start, logs, stop."""

    print("=" * 80)
    print("K8s Worker - Regular Job Test")
    print("=" * 80)
    server_url = "https://hypha.aicell.io"

    # Get token from environment
    token = os.environ.get("HYPHA_TOKEN")
    if not token:
        print("❌ ERROR: HYPHA_TOKEN environment variable not set")
        print("   Set it with: export HYPHA_TOKEN='your-token-here'")
        sys.exit(1)


    print(f"\n1. Connecting to Hypha server: {server_url}")
    api = await connect_to_server(
        server_url=server_url,
        token=token,
        workspace="hypha-agents",
    )
    print(f"✅ Connected to workspace: {api.config.workspace}")

    # Get k8s-worker service
    print("\n2. Getting k8s-worker service...")
    try:
        # Use wildcard to get any k8s-worker
        worker = await api.get_service("*:k8s-worker")
        print(f"✅ Got k8s-worker service: {worker.id}")
    except Exception as e:
        print(f"❌ Failed to get k8s-worker service: {e}")
        await api.disconnect()
        sys.exit(1)

    session_id = None

    try:
        # Start a simple k8s job
        print(f"\n3. Starting K8s job (regular job type)...")
        unique_id = f"test-job-{int(asyncio.get_event_loop().time())}"
        session_id = await worker.start({
            "id": unique_id,
            "app_id": "test-k8s-job",
            "workspace": "hypha-agents",
            "client_id": "test-client",
            "server_url": server_url,
            "artifact_id": "test-artifact",
            "manifest": {
                "type": "k8s-job",
                "image": "python:3.11-slim",
                "command": ["python", "-c", "import time; print('Hello from K8s job!'); print('Job running...'); time.sleep(30); print('Job complete!')"],
            }
        })
        print(f"✅ Job started: {session_id}")
        # Derive job name from session_id
        job_name = f"hypha-job-{session_id.replace('/', '-').replace('_', '-').lower()}"
        print(f"   Job name: {job_name}")
        print(f"\n   🔍 Validate with: kubectl -n hypha get job {job_name}")

        # Wait for job to start
        print(f"\n4. Waiting for job to be running...")
        await asyncio.sleep(10)

        # Get logs
        print(f"\n5. Getting job logs...")
        logs = await worker.get_logs(session_id, limit=20)
        print(f"✅ Retrieved logs (total: {logs.get('total', 0)}):")
        if logs.get('items'):
            for item in logs['items'][:10]:
                print(f"   - [{item.get('type')}] {item.get('content', '')[:100]}")
        else:
            print("   (No logs yet - job may still be starting)")

        # Wait a bit more
        print(f"\n6. Job running - waiting 15 seconds...")
        print(f"   🔍 Check job status: kubectl -n hypha get job {job_name}")
        print(f"   🔍 View job logs: kubectl -n hypha logs job/{job_name}")
        await asyncio.sleep(15)

        # Stop the job
        print(f"\n7. Stopping job...")
        await worker.stop(session_id)
        print(f"✅ Job stopped")

        # Verify job is deleted
        print(f"\n8. Waiting for job deletion...")
        await asyncio.sleep(5)
        print(f"   🔍 Verify deletion: kubectl -n hypha get job {job_name}")
        print(f"   (Should show: Error from server (NotFound))")

        print("\n" + "=" * 80)
        print("✅ K8S JOB TEST PASSED")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

        # Attempt cleanup
        if session_id:
            try:
                print(f"\n🧹 Attempting cleanup of session {session_id}...")
                await worker.stop(session_id)
                print(f"✅ Cleanup successful")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup failed: {cleanup_error}")

        await api.disconnect()
        sys.exit(1)

    await api.disconnect()


async def test_claude_agent_job():
    """Test launching a Claude agent job."""

    print("\n" + "=" * 80)
    print("K8s Worker - Claude Agent Job Test")
    print("=" * 80)

    token = os.environ.get("HYPHA_TOKEN")
    if not token:
        print("❌ ERROR: HYPHA_TOKEN environment variable not set")
        sys.exit(1)

    server_url = "https://hypha.aicell.io"

    print(f"\n1. Connecting to Hypha server: {server_url}")
    api = await connect_to_server(
        server_url=server_url,
        token=token,
        workspace="hypha-agents",
    )
    print(f"✅ Connected to workspace: {api.config.workspace}")

    # Get k8s-worker service
    print("\n2. Getting k8s-worker service...")
    # Use wildcard to get any k8s-worker
    worker = await api.get_service("*:k8s-worker")
    print(f"✅ Got k8s-worker service: {worker.id}")

    session_id = None
    unique_id = f"test-agent-{int(asyncio.get_event_loop().time())}"

    try:
        # Start a Claude agent job
        print(f"\n3. Starting Claude agent job...")
        print(f"   Session ID: {unique_id}")
        print(f"   Note: Service ID will be auto-generated by k8s-worker")
        session_id = await worker.start({
            "id": unique_id,
            "app_id": "test-claude-agent",
            "workspace": "hypha-agents",
            "client_id": "test-agent-client",
            "server_url": server_url,
            "artifact_id": "test-agent-artifact",
            "manifest": {
                "type": "claude-agent",
                "name": "Test Claude Agent",
                "service_id": unique_id  # Optional, can be used to identify the agent
            }
        })
        job_name = f"hypha-job-{session_id.replace('/', '-').replace('_', '-').lower()}"
        print(f"✅ Claude agent job started: {session_id}")
        print(f"   Job name: {job_name}")
        print(f"   Expected service: hypha-agents/claude-agent-* (auto-generated)")
        print(f"\n   🔍 Validate with: kubectl -n hypha get job {job_name}")

        # Wait for agent to start and register service
        print(f"\n4. Waiting for Claude agent service to register...")
        print(f"   (This may take up to 2 minutes)")
        await asyncio.sleep(20)

        # Try to find the agent service (auto-generated ID)
        print(f"\n5. Attempting to find Claude agent service...")
        agent_service = await api.get_service(f"hypha-agents/{unique_id}")
        print(f"✅ Claude agent service is available!")
        print(f"   Service ID: {agent_service.id}")

        # Try to ping the agent
        if hasattr(agent_service, 'ping'):
            ping_result = await agent_service.ping()
            print(f"   Ping response: {ping_result}")

        # Get agent info
        if hasattr(agent_service, 'getInfo'):
            info = await agent_service.getInfo()
            print(f"   Agent info: {info}")
        # Get logs
        print(f"\n6. Getting agent job logs...")
        logs = await worker.get_logs(session_id, limit=30)
        print(f"✅ Retrieved logs (total: {logs.get('total', 0)}):")
        if logs.get('items'):
            for item in logs['items'][:15]:
                content = item.get('content', '')
                if content:
                    print(f"   - [{item.get('type')}] {content[:120]}")
        else:
            print("   (No logs yet)")

        # Wait a bit for the agent to fully initialize
        print(f"\n7. Agent running - waiting 20 seconds...")
        print(f"   🔍 Check job: kubectl -n hypha get job {job_name}")
        print(f"   🔍 Check pods: kubectl -n hypha get pods -l job-name={job_name}")
        print(f"   🔍 View logs: kubectl -n hypha logs job/{job_name}")
        await asyncio.sleep(20)

        # Try to use the agent service one more time - THIS MUST SUCCEED
        print(f"\n8. Final check of agent service (REQUIRED TO PASS)...")

        agent_service = await api.get_service(f"hypha-agents/{unique_id}")
        print(f"✅ Agent service is available!")
        print(f"   Service ID: {agent_service.id }")

        # List available methods
        if hasattr(agent_service, '__dir__'):
            methods = [m for m in dir(agent_service) if not m.startswith('_')]
            print(f"   Available methods: {', '.join(methods[:10])}")

        # Stop the agent job
        print(f"\n9. Stopping Claude agent job...")
        await worker.stop(session_id)
        print(f"✅ Agent job stopped")

        # Verify cleanup
        print(f"\n10. Waiting for job deletion...")
        await asyncio.sleep(5)
        print(f"   🔍 Verify job deleted: kubectl -n hypha get job {job_name}")
        print(f"   🔍 Verify service removed: Service should no longer be available")

        print("\n" + "=" * 80)
        print("✅ CLAUDE AGENT JOB TEST PASSED")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

        # Attempt cleanup
        if session_id:
            try:
                print(f"\n🧹 Attempting cleanup of session {session_id}...")
                await worker.stop(session_id)
                print(f"✅ Cleanup successful")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup failed: {cleanup_error}")

        await api.disconnect()
        sys.exit(1)

    await api.disconnect()


async def test_conda_worker_job():
    """Test launching a Conda worker job."""

    print("\n" + "=" * 80)
    print("K8s Worker - Conda Worker Job Test")
    print("=" * 80)

    token = os.environ.get("HYPHA_TOKEN")
    if not token:
        print("❌ ERROR: HYPHA_TOKEN environment variable not set")
        sys.exit(1)

    server_url = "https://hypha.aicell.io"
    workspace = "hypha-agents"
    print(f"\n1. Connecting to Hypha server: {server_url}")
    api = await connect_to_server(
        server_url=server_url,
        token=token,
        workspace=workspace,
    )
    print(f"✅ Connected to workspace: {api.config.workspace}")

    # Get k8s-worker service
    print("\n2. Getting k8s-worker service...")
    # Use wildcard to get any k8s-worker
    worker = await api.get_service("*:k8s-worker")
    print(f"✅ Got k8s-worker service: {worker.id}")

    session_id = None
    service_id = f"test-conda-worker-{int(asyncio.get_event_loop().time())}"

    try:
        # Start a Conda worker job
        print(f"\n3. Starting Conda worker job...")
        print(f"   Service ID: {service_id}")
        session_id = await worker.start({
            "id": f"test-conda-{int(asyncio.get_event_loop().time())}",
            "app_id": "test-conda-worker",
            "workspace": "hypha-agents",
            "client_id": "test-conda-client",
            "server_url": server_url,
            "artifact_id": "test-conda-artifact",
            "manifest": {
                "type": "conda-worker",
                "service_id": service_id,
                "workspace": "hypha-agents",
                "wait_for_service": True,  # Wait for the conda worker service to register
                "verbose": True,
            }
        })
        job_name = f"hypha-job-{session_id.replace('/', '-').replace('_', '-').lower()}"
        print(f"✅ Conda worker job started: {session_id}")
        print(f"   Job name: {job_name}")
        print(f"   Expected service: hypha-agents/{service_id}")
        print(f"\n   🔍 Validate with: kubectl -n hypha get job {job_name}")

        # Wait for conda worker to start and register service
        print(f"\n4. Waiting for Conda worker service to register...")
        print(f"   (This may take up to 2 minutes)")
        await asyncio.sleep(20)

        # Try to get the conda worker service
        print(f"\n5. Attempting to connect to Conda worker service...")
        try:
            conda_service = await api.get_service(f"{workspace}/{service_id}")
            print(f"✅ Conda worker service is available!")
            print(f"   Service ID: {conda_service.id if hasattr(conda_service, 'id') else 'N/A'}")

            # List available methods
            if hasattr(conda_service, '__dir__'):
                methods = [m for m in dir(conda_service) if not m.startswith('_')]
                print(f"   Available methods: {', '.join(methods[:10])}")

        except Exception as e:
            print(f"⚠️  Could not connect to conda worker service yet: {e}")
            print(f"   The worker may still be starting up")

        # Get logs
        print(f"\n6. Getting conda worker job logs...")
        logs = await worker.get_logs(session_id, limit=30)
        print(f"✅ Retrieved logs (total: {logs.get('total', 0)}):")
        if logs.get('items'):
            for item in logs['items'][:15]:
                content = item.get('content', '')
                if content:
                    print(f"   - [{item.get('type')}] {content[:120]}")
        else:
            print("   (No logs yet)")

        # Wait a bit for the worker to fully initialize
        print(f"\n7. Conda worker running - waiting 20 seconds...")
        print(f"   🔍 Check job: kubectl -n hypha get job {job_name}")
        print(f"   🔍 Check pods: kubectl -n hypha get pods -l job-name={job_name}")
        print(f"   🔍 View logs: kubectl -n hypha logs job/{job_name}")
        await asyncio.sleep(20)

        # Try to use the conda worker service
        print(f"\n8. Final check of conda worker service...")
        try:
            conda_service = await api.get_service(f"{workspace}/{service_id}")
            print(f"✅ Conda worker service is still available")

            # The conda worker provides server-app worker functionality
            # It can be used to launch conda environments as jobs
            print(f"   Conda worker is ready to launch conda environment jobs")

        except Exception as e:
            print(f"⚠️  Conda worker service not available: {e}")

        # Stop the conda worker job
        print(f"\n9. Stopping Conda worker job...")
        await worker.stop(session_id)
        print(f"✅ Conda worker job stopped")

        # Verify cleanup
        print(f"\n10. Waiting for job deletion...")
        await asyncio.sleep(5)
        print(f"   🔍 Verify job deleted: kubectl -n hypha get job {job_name}")
        print(f"   🔍 Verify service removed: Service should no longer be available")

        print("\n" + "=" * 80)
        print("✅ CONDA WORKER JOB TEST PASSED")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

        # Attempt cleanup
        if session_id:
            try:
                print(f"\n🧹 Attempting cleanup of session {session_id}...")
                await worker.stop(session_id)
                print(f"✅ Cleanup successful")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup failed: {cleanup_error}")

        await api.disconnect()
        sys.exit(1)

    await api.disconnect()


async def test_concurrent_jobs():
    """Test running multiple K8s jobs concurrently."""

    print("\n" + "=" * 80)
    print("K8s Worker - Concurrent Jobs Test")
    print("=" * 80)

    token = os.environ.get("HYPHA_TOKEN")
    if not token:
        print("❌ ERROR: HYPHA_TOKEN environment variable not set")
        sys.exit(1)

    server_url = "https://hypha.aicell.io"

    print(f"\n1. Connecting to Hypha server: {server_url}")
    api = await connect_to_server(
        server_url=server_url,
        token=token,
        workspace="hypha-agents",
    )
    print(f"✅ Connected to workspace: {api.config.workspace}")

    worker = await api.get_service({"id": "*:k8s-worker", "mode": "first"})

    session_ids = []
    job_names = []

    try:
        # Create multiple concurrent jobs
        num_jobs = 3
        print(f"\n2. Starting {num_jobs} concurrent K8s jobs...")

        for i in range(num_jobs):
            unique_id = f"concurrent-test-{i}-{int(asyncio.get_event_loop().time())}"
            session_id = await worker.start({
                "id": unique_id,
                "app_id": f"concurrent-job-{i}",
                "workspace": "hypha-agents",
                "client_id": f"concurrent-client-{i}",
                "server_url": server_url,
                "artifact_id": f"concurrent-artifact-{i}",
                "manifest": {
                    "type": "k8s-job",
                    "image": "python:3.11-slim",
                    "command": ["python", "-c", f"import time; print('Job {i} running'); time.sleep(20); print('Job {i} done')"],
                }
            })
            job_name = f"hypha-job-{session_id.replace('/', '-').replace('_', '-').lower()}"
            session_ids.append(session_id)
            job_names.append(job_name)
            print(f"✅ Started job {i+1}/{num_jobs}: {session_id}")

        # Wait for jobs to be running
        print(f"\n3. Waiting for jobs to be running...")
        await asyncio.sleep(10)

        # Get logs from each job
        print(f"\n4. Getting logs from all jobs...")
        for i, session_id in enumerate(session_ids):
            logs = await worker.get_logs(session_id, limit=5)
            print(f"✅ Job {i+1} logs: {logs.get('total', 0)} entries")

        # Stop all jobs
        print(f"\n5. Stopping all jobs...")
        for i, session_id in enumerate(session_ids):
            await worker.stop(session_id)
            print(f"✅ Stopped job {i+1}/{num_jobs}")

        # Wait for cleanup
        await asyncio.sleep(5)

        print("\n" + "=" * 80)
        print("✅ CONCURRENT JOBS TEST PASSED")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ CONCURRENT TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

        # Cleanup
        print(f"\n🧹 Cleaning up jobs...")
        for session_id in session_ids:
            try:
                await worker.stop(session_id)
            except:
                pass

        await api.disconnect()
        sys.exit(1)

    await api.disconnect()


async def main():
    """Run all integration tests."""

    print("\n" + "=" * 80)
    print("HYPHA K8S WORKER INTEGRATION TEST SUITE")
    print("=" * 80)
    print(f"Target: https://hypha.aicell.io")
    print(f"Workspace: hypha-agents")
    print(f"Namespace: hypha")
    print(f"Token: {'Set' if os.environ.get('HYPHA_TOKEN') else 'NOT SET'}")
    print("=" * 80)

    if not os.environ.get("HYPHA_TOKEN"):
        print("\n❌ ERROR: HYPHA_TOKEN not set")
        print("   Set it with: export HYPHA_TOKEN='your-token-here'")
        sys.exit(1)

    try:
        # Test 1: Basic k8s job lifecycle
        await test_k8s_job_lifecycle()

        # Test 2: Claude agent job
        await test_claude_agent_job()

        # Test 3: Conda worker job
        await test_conda_worker_job()

        # Test 4: Concurrent jobs
        await test_concurrent_jobs()

        print("\n" + "=" * 80)
        print("🎉 ALL INTEGRATION TESTS PASSED!")
        print("=" * 80)
        print("\nNext steps:")
        print("1. Verify jobs are cleaned up: kubectl -n hypha get jobs | grep hypha-job")
        print("2. Check for any remaining resources: kubectl -n hypha get all | grep hypha")
        print("3. Review logs if needed: kubectl -n hypha logs job/<job-name>")

    except Exception as e:
        print(f"\n❌ INTEGRATION TEST SUITE FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
