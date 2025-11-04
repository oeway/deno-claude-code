"""Kubernetes Worker for launching jobs in Kubernetes clusters."""

import asyncio
import logging
import os
import re
import sys
import time
import uuid
import yaml
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Callable

from kubernetes import client, config
from kubernetes.client.rest import ApiException
from kubernetes.stream import stream

from pydantic import Field
from hypha_rpc.utils.schema import schema_method
from base import (
    BaseWorker,
    WorkerConfig,
    SessionStatus,
    SessionInfo,
    SessionNotFoundError,
    WorkerError,
    WorkerNotAvailableError,
    safe_call_callback,
)

LOGLEVEL = os.environ.get("HYPHA_LOGLEVEL", "WARNING").upper()
logging.basicConfig(level=LOGLEVEL, stream=sys.stdout)
logger = logging.getLogger("k8s")
logger.setLevel(LOGLEVEL)

def to_k8s_job_name(session_id: str) -> str:
    """Convert session ID to valid Kubernetes job name."""
    sanitized_id = re.sub(r'[^a-zA-Z0-9-]', '-', session_id)
    sanitized_id = re.sub(r'-+', '-', sanitized_id)
    sanitized_id = sanitized_id.strip('-')
    if sanitized_id and not sanitized_id[0].isalnum():
        sanitized_id = f"s{sanitized_id}"
    if not sanitized_id:
        sanitized_id = str(uuid.uuid4().hex[:8])
    if len(sanitized_id) > 50:
        sanitized_id = sanitized_id[:50].rstrip('-')
    job_name = f"hypha-job-{sanitized_id}".lower()
    return job_name


class KubernetesWorker(BaseWorker):
    """Kubernetes worker for launching jobs in Kubernetes clusters."""

    instance_counter: int = 0

    def __init__(
        self,
        namespace: str = "default",
        default_timeout: int = 3600,
        image_pull_policy: str = "IfNotPresent",
        server_url: str = None,
    ):
        """Initialize the Kubernetes worker."""
        super().__init__()
        self.namespace = namespace
        self.default_timeout = default_timeout
        self.image_pull_policy = image_pull_policy
        self.server_url = server_url or os.environ.get("HYPHA_SERVER_URL", "https://hypha.aicell.io")

        self.instance_id = f"k8s-worker-{uuid.uuid4().hex[:8]}"
        self.controller_id = str(KubernetesWorker.instance_counter)
        KubernetesWorker.instance_counter += 1

        # Session management
        self._sessions: Dict[str, SessionInfo] = {}
        self._session_data: Dict[str, Dict[str, Any]] = {}

        # Initialize Kubernetes client
        self._init_k8s_client()

    def _init_k8s_client(self):
        """Initialize Kubernetes client."""
        try:
            # Try to load in-cluster config first (when running in a pod)
            config.load_incluster_config()
            logger.info("Loaded in-cluster Kubernetes config")
        except config.ConfigException:
            try:
                # Fall back to local kubeconfig
                config.load_kube_config()
                logger.info("Loaded local Kubernetes config")
            except config.ConfigException:
                error_msg = "Unable to load Kubernetes config"
                logger.error(error_msg)
                raise WorkerNotAvailableError(error_msg)

        self.v1 = client.CoreV1Api()
        self.batch_v1 = client.BatchV1Api()
        logger.info(f"Kubernetes client initialized for namespace: {self.namespace}")

    @property
    def supported_types(self) -> List[str]:
        """Return list of supported application types."""
        return ["k8s-job", "claude-agent", "conda-worker"]

    @property
    def name(self) -> str:
        """Return the worker name."""
        return f"Kubernetes Job Worker (namespace: {self.namespace})"

    @property
    def description(self) -> str:
        """Return the worker description."""
        return f"A worker for launching jobs in Kubernetes cluster namespace '{self.namespace}'"

    @property
    def require_context(self) -> bool:
        """Return whether the worker requires a context."""
        return True

    @schema_method
    async def compile(
        self,
        manifest: dict = Field(..., description="Application manifest for Kubernetes job. For 'k8s-job': Required fields: 'image' (container image with tag). Optional: 'image_pull_policy', 'restart_policy', 'timeout', 'env', 'command'. For 'claude-agent': No additional fields needed."),
        files: list = Field(..., description="List of application files (currently not used by Kubernetes worker)."),
        config: dict = Field(None, description="Optional compilation configuration settings."),
        context: Optional[Dict[str, Any]] = None,
    ) -> tuple[dict, list]:
        """Compile Kubernetes job application - validate manifest."""
        job_type = manifest.get("type", "k8s-job")

        if job_type == "claude-agent":
            # For Claude agent, we don't need additional validation
            # The manifest will be processed in _start_claude_agent
            manifest.setdefault("timeout", self.default_timeout)
            logger.info("Compiled Claude agent manifest")
            return manifest, files

        # For regular k8s-job, validate manifest has required fields
        required_fields = ["image"]
        for field in required_fields:
            if field not in manifest:
                raise WorkerError(f"Required field '{field}' missing from manifest")

        # Set defaults
        manifest.setdefault("image_pull_policy", self.image_pull_policy)
        manifest.setdefault("restart_policy", "Never")
        manifest.setdefault("timeout", self.default_timeout)

        # Validate image format
        image = manifest["image"]
        if not image or ":" not in image:
            raise WorkerError(f"Invalid image format: {image}")

        # Validate environment variables format
        env = manifest.get("env", {})
        if not isinstance(env, dict):
            raise WorkerError("Environment variables must be a dictionary")

        # Validate command format
        command = manifest.get("command", [])
        if command and not isinstance(command, list):
            raise WorkerError("Command must be a list")

        logger.info(f"Compiled Kubernetes job manifest for image: {image}")
        return manifest, files

    @schema_method
    async def start(
        self,
        config: Union[WorkerConfig, Dict[str, Any]] = Field(..., description="Worker configuration containing session_id, app_id, workspace, client_id, manifest, and token."),
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Start a new Kubernetes job session."""
        # Handle both pydantic model and dict input for RPC compatibility
        if isinstance(config, dict):
            config = WorkerConfig(**config)

        session_id = config.id
        progress_callback = getattr(config, "progress_callback", None)
        job_type = config.manifest.get("type", "k8s-job")

        if session_id in self._sessions:
            raise WorkerError(f"Session {session_id} already exists")

        # Report initial progress
        await safe_call_callback(progress_callback,
            {
                "type": "info",
                "message": f"Starting Kubernetes {job_type} session {session_id}",
            }
        )

        # Create session info
        session_info = SessionInfo(
            session_id=session_id,
            app_id=config.app_id,
            workspace=config.workspace,
            client_id=config.client_id,
            status=SessionStatus.STARTING,
            app_type=job_type,
            entry_point=config.entry_point,
            created_at=datetime.now().isoformat(),
            metadata=config.manifest,
        )

        self._sessions[session_id] = session_info

        try:
            if job_type == "claude-agent":
                session_data = await self._start_claude_agent(config, session_id, progress_callback)
            elif job_type == "conda-worker":
                session_data = await self._start_conda_worker(config, session_id, progress_callback)
            else:
                session_data = await self._start_k8s_job(config, session_id, progress_callback)

            self._session_data[session_id] = session_data

            # Update session status
            session_info.status = SessionStatus.RUNNING

            await safe_call_callback(progress_callback,
                {
                    "type": "success",
                    "message": f"Kubernetes {job_type} session {session_id} started successfully",
                }
            )

            logger.info(f"Started Kubernetes {job_type} session {session_id}")
            return session_id

        except Exception as e:
            session_info.status = SessionStatus.FAILED
            session_info.error = str(e)

            await safe_call_callback(progress_callback,
                {
                    "type": "error",
                    "message": f"Failed to start Kubernetes session: {str(e)}",
                }
            )

            logger.error(f"Failed to start Kubernetes session {session_id}: {e}")
            # Clean up failed session
            self._sessions.pop(session_id, None)
            raise

    async def _start_claude_agent(
        self, config: WorkerConfig, session_id: str, progress_callback=None
    ) -> Dict[str, Any]:
        """Start a Claude agent job session."""
        logs = {
            "stdout": [],
            "stderr": [],
            "info": [f"Claude agent job session started successfully"],
            "error": [],
            "progress": [],
        }

        def progress_callback_wrapper(message):
            logs["progress"].append(f"{message['type'].upper()}: {message['message']}")
            if progress_callback:
                progress_callback(message)

        manifest = config.manifest
        timeout = manifest.get("timeout", self.default_timeout)
        wait_for_service = manifest.get("wait_for_service", True)
        # Generate unique service ID for each agent to avoid conflicts
        service_id = manifest.get("service_id", f"claude-agent-{uuid.uuid4().hex[:8]}")

        progress_callback_wrapper(
            {"type": "info", "message": f"Creating Claude agent job"}
        )

        job_name = to_k8s_job_name(session_id)

        # Load the Claude agent job template
        job_template = self._create_claude_agent_job_spec(
            job_name=job_name,
            config=config,
            session_id=session_id,
            service_id=service_id
        )

        try:
            # Create the job in Kubernetes
            self.batch_v1.create_namespaced_job(namespace=self.namespace, body=job_template)

            progress_callback_wrapper(
                {
                    "type": "success",
                    "message": f"Job {job_name} created successfully",
                }
            )

            # Wait for pod to be created from the job
            progress_callback_wrapper(
                {"type": "info", "message": "Waiting for job pod to start..."}
            )

            start_time = time.time()
            max_wait_time = 300  # 5 minutes
            pod_name = None

            while time.time() - start_time < max_wait_time:
                try:
                    # Get pods created by this job
                    pods = self.v1.list_namespaced_pod(
                        namespace=self.namespace,
                        label_selector=f"job-name={job_name}"
                    )

                    if pods.items:
                        pod = pods.items[0]
                        pod_name = pod.metadata.name
                        phase = pod.status.phase

                        if phase == "Running":
                            progress_callback_wrapper(
                                {
                                    "type": "success",
                                    "message": f"Pod {pod_name} is now running",
                                }
                            )
                            break
                        elif phase == "Failed":
                            raise WorkerError(f"Pod {pod_name} failed to start")
                        elif phase == "Succeeded":
                            progress_callback_wrapper(
                                {
                                    "type": "info",
                                    "message": f"Pod {pod_name} completed immediately",
                                }
                            )
                            break

                    await asyncio.sleep(2)

                except ApiException as e:
                    if e.status == 404:
                        await asyncio.sleep(2)
                        continue
                    raise

            else:
                raise WorkerError(f"Timeout waiting for job {job_name} pod to start")

            # Wait for the service to be registered
            if wait_for_service and pod_name:
                progress_callback_wrapper(
                    {"type": "info", "message": f"Waiting for service '{service_id}' to be registered..."}
                )

                await self._wait_for_hypha_service(
                    workspace=config.workspace,
                    service_id=service_id,
                    timeout=120,
                    progress_callback=progress_callback_wrapper
                )

        except ApiException as e:
            progress_callback_wrapper(
                {
                    "type": "error",
                    "message": f"Kubernetes API error: {str(e)}",
                }
            )
            raise WorkerError(f"Failed to create job: {str(e)}")

        return {
            "job_name": job_name,
            "pod_name": pod_name,
            "service_id": service_id,
            "logs": logs,
            "timeout": timeout,
        }

    def _create_claude_agent_job_spec(
        self, job_name: str, config: WorkerConfig, session_id: str, service_id: str
    ) -> Dict[str, Any]:
        """Create a Kubernetes Job spec for Claude agent."""
        manifest = config.manifest

        # Get secret name for tokens (default to deno-claude-code-config)
        secret_name = manifest.get("secret_name", "deno-claude-code-config")

        # Build environment variables - include Hypha configuration automatically
        env_vars = []

        # Use internal cluster URL for better connectivity from within cluster
        server_url = manifest.get("server_url")
        if not server_url:
            # Default to internal cluster URL if worker's server_url suggests we're in cluster
            if "hypha-server.hypha.svc.cluster.local" in self.server_url:
                server_url = self.server_url
            else:
                # Try internal URL first for in-cluster deployments
                server_url = "http://hypha-server.hypha.svc.cluster.local:9520"

        # Add Hypha environment variables automatically
        hypha_env = {
            "HYPHA_SERVER_URL": server_url,
            "HYPHA_WORKSPACE": config.workspace,
            "HYPHA_CLIENT_ID": config.client_id,
            "AGENT_BASE_DIRECTORY": "/app/agent-workspaces",
            "AGENT_MAX_COUNT": "10",
            "SERVICE_ID": service_id,
            "SERVICE_VISIBILITY": "public",
        }

        # Merge with user-provided environment variables (user variables take precedence)
        user_env = manifest.get("env", {})
        merged_env = {**hypha_env, **user_env}

        # Add non-secret env vars
        for key, value in merged_env.items():
            env_vars.append(client.V1EnvVar(name=key, value=str(value)))

        # Add secret env vars (ANTHROPIC_API_KEY and HYPHA_TOKEN from workspace secret)
        # IMPORTANT: Use HYPHA_WORKSPACE_TOKEN from claude-agent-workspace-token which has workspace scope,
        # not the user's personal token which would register in wrong workspace
        env_vars.extend([
            client.V1EnvVar(
                name="ANTHROPIC_API_KEY",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name=secret_name,
                        key="ANTHROPIC_API_KEY"
                    )
                )
            ),
            client.V1EnvVar(
                name="HYPHA_TOKEN",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="claude-agent-workspace-token",
                        key="HYPHA_WORKSPACE_TOKEN"
                    )
                )
            ),
        ])

        # Create container spec with security context
        container = client.V1Container(
            name="claude-agent",
            image=manifest.get("image", "oeway/deno-claude-code:0.1.2"),
            image_pull_policy=manifest.get("image_pull_policy", "Always"),
            env=env_vars,
            security_context=client.V1SecurityContext(
                allow_privilege_escalation=False,
                capabilities=client.V1Capabilities(drop=["ALL"]),
                run_as_non_root=True,
                read_only_root_filesystem=False,
                seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
            ),
            resources=client.V1ResourceRequirements(
                requests={"memory": "512Mi", "cpu": "500m"},
                limits={"memory": "2Gi", "cpu": "2000m"},
            ),
            volume_mounts=[
                client.V1VolumeMount(
                    name="agent-workspaces",
                    mount_path="/app/agent-workspaces"
                )
            ],
        )

        # Create pod spec with security context
        pod_spec = client.V1PodSpec(
            containers=[container],
            restart_policy="OnFailure",
            service_account_name="default",
            security_context=client.V1PodSecurityContext(
                run_as_user=1000,
                run_as_group=1000,
                fs_group=1000,
                run_as_non_root=True,
                seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
            ),
            volumes=[
                client.V1Volume(
                    name="agent-workspaces",
                    empty_dir=client.V1EmptyDirVolumeSource()
                )
            ],
        )

        # Create job metadata with labels and annotations
        job_metadata = client.V1ObjectMeta(
            name=job_name,
            labels={
                "app": "claude-agent-worker",
                "hypha-app-id": config.app_id[:63] if len(config.app_id) > 63 else config.app_id,
            },
            annotations={
                "hypha.amun.ai/app-id": config.app_id,
                "hypha.amun.ai/workspace": config.workspace,
                "hypha.amun.ai/client-id": config.client_id,
                "hypha.amun.ai/session-id": session_id,
                "hypha.amun.ai/created-at": datetime.now().isoformat(),
                "hypha.amun.ai/worker-type": "claude-agent",
            },
        )

        # Create pod template
        pod_template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={
                    "app": "claude-agent-worker",
                }
            ),
            spec=pod_spec,
        )

        # Create job spec
        job_spec = client.V1JobSpec(
            template=pod_template,
            backoff_limit=3,
            ttl_seconds_after_finished=3600,
        )

        # Create the job
        job = client.V1Job(
            api_version="batch/v1",
            kind="Job",
            metadata=job_metadata,
            spec=job_spec,
        )

        return job

    async def _start_conda_worker(
        self, config: WorkerConfig, session_id: str, progress_callback=None
    ) -> Dict[str, Any]:
        """Start a Conda worker job session."""
        logs = {
            "stdout": [],
            "stderr": [],
            "info": [f"Conda worker job session started successfully"],
            "error": [],
            "progress": [],
        }

        def progress_callback_wrapper(message):
            logs["progress"].append(f"{message['type'].upper()}: {message['message']}")
            if progress_callback:
                progress_callback(message)

        manifest = config.manifest
        # Generate random service ID if not provided
        service_id = manifest.get("service_id", f"conda-worker-{uuid.uuid4().hex[:8]}")
        workspace = manifest.get("workspace", config.workspace)
        wait_for_service = manifest.get("wait_for_service", True)

        progress_callback_wrapper(
            {"type": "info", "message": f"Creating Conda worker job"}
        )

        job_name = to_k8s_job_name(session_id)

        # Create the Conda worker job spec
        job_template = self._create_conda_worker_job_spec(
            job_name=job_name,
            config=config,
            session_id=session_id,
            service_id=service_id
        )

        try:
            # Create the job in Kubernetes
            self.batch_v1.create_namespaced_job(namespace=self.namespace, body=job_template)

            progress_callback_wrapper(
                {
                    "type": "success",
                    "message": f"Conda worker job {job_name} created successfully",
                }
            )

            # Wait for pod to be created from the job
            progress_callback_wrapper(
                {"type": "info", "message": "Waiting for conda worker pod to start..."}
            )

            start_time = time.time()
            max_wait_time = 300  # 5 minutes
            pod_name = None

            while time.time() - start_time < max_wait_time:
                try:
                    # Get pods created by this job
                    pods = self.v1.list_namespaced_pod(
                        namespace=self.namespace,
                        label_selector=f"job-name={job_name}"
                    )

                    if pods.items:
                        pod = pods.items[0]
                        pod_name = pod.metadata.name
                        phase = pod.status.phase

                        if phase == "Running":
                            progress_callback_wrapper(
                                {
                                    "type": "success",
                                    "message": f"Conda worker pod {pod_name} is now running",
                                }
                            )
                            break
                        elif phase == "Failed":
                            raise WorkerError(f"Conda worker pod {pod_name} failed to start")

                    await asyncio.sleep(2)

                except ApiException as e:
                    if e.status == 404:
                        await asyncio.sleep(2)
                        continue
                    raise

            else:
                raise WorkerError(f"Timeout waiting for conda worker job {job_name} pod to start")

            # Wait for the conda worker service to be registered
            if wait_for_service and pod_name:
                progress_callback_wrapper(
                    {"type": "info", "message": f"Waiting for conda worker service {service_id} to register..."}
                )
                await self._wait_for_hypha_service(
                    workspace=workspace,
                    service_id=service_id,
                    timeout=120,
                    progress_callback=progress_callback_wrapper
                )

            logs["info"].append(f"Conda worker job {job_name} started and running as pod {pod_name}")

            return {
                "session_id": session_id,
                "job_name": job_name,
                "pod_name": pod_name,
                "service_id": service_id,
                "logs": logs,
            }

        except Exception as e:
            logs["error"].append(f"Failed to start conda worker job: {str(e)}")
            raise

    def _create_conda_worker_job_spec(
        self, job_name: str, config: WorkerConfig, session_id: str, service_id: str
    ) -> client.V1Job:
        """Create Kubernetes Job spec for conda worker."""
        manifest = config.manifest
        workspace = manifest.get("workspace", config.workspace)
        visibility = manifest.get("visibility", "protected")

        # Use ghcr.io/amun-ai/hypha:0.21.25 image
        image = manifest.get("image", "oeway/hypha-conda-worker:0.1.0")

        # Environment variables for Conda worker
        env_vars = [
            client.V1EnvVar(name="HYPHA_SERVER_URL", value=config.server_url),
            client.V1EnvVar(name="HYPHA_WORKSPACE", value=workspace),
            client.V1EnvVar(name="HYPHA_SERVICE_ID", value=service_id),
            client.V1EnvVar(name="HYPHA_VISIBILITY", value=visibility),
        ]

        # Add HYPHA_TOKEN from secret if specified
        token_secret = manifest.get("token_secret", "hypha-secrets")
        token_key = manifest.get("token_key", "HYPHA_AGENTS_TOKEN")
        env_vars.append(
            client.V1EnvVar(
                name="HYPHA_TOKEN",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name=token_secret,
                        key=token_key
                    )
                )
            )
        )

        # Add verbose flag if requested
        verbose = manifest.get("verbose", True)

        # Build command - run conda worker
        command = [
            "python", "-m", "hypha.workers.conda",
            "--server-url", "$(HYPHA_SERVER_URL)",
            "--workspace", "$(HYPHA_WORKSPACE)",
            "--token", "$(HYPHA_TOKEN)",
            "--service-id", service_id,
        ]

        if verbose:
            command.append("--verbose")

        # Container spec - Conda worker runs as user 'hypha' (uid=8877)
        # NOTE: The ghcr.io/amun-ai/hypha base image runs as user 'hypha' (uid=8877, gid=8877)
        container = client.V1Container(
            name="conda-worker",
            image=image,
            image_pull_policy=self.image_pull_policy,
            command=command,
            env=env_vars,
            security_context=client.V1SecurityContext(
                allow_privilege_escalation=False,
                run_as_non_root=True,
                run_as_user=8877,
                run_as_group=8877,
                capabilities=client.V1Capabilities(drop=["ALL"]),
                seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
            ),
        )

        # Pod template with security context for user 8877
        pod_template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={
                    "job-name": job_name,
                    "app": "conda-worker",
                    "managed-by": "hypha-k8s-worker",
                }
            ),
            spec=client.V1PodSpec(
                restart_policy="Never",
                containers=[container],
                security_context=client.V1PodSecurityContext(
                    run_as_non_root=True,
                    run_as_user=8877,
                    run_as_group=8877,
                    fs_group=8877,
                    seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
                ),
            ),
        )

        # Job spec
        job = client.V1Job(
            api_version="batch/v1",
            kind="Job",
            metadata=client.V1ObjectMeta(
                name=job_name,
                labels={
                    "app": "conda-worker",
                    "managed-by": "hypha-k8s-worker",
                    "session-id": session_id,
                },
            ),
            spec=client.V1JobSpec(
                template=pod_template,
                backoff_limit=3,
                ttl_seconds_after_finished=3600,  # Clean up after 1 hour
            ),
        )

        return job

    async def _wait_for_hypha_service(
        self, workspace: str, service_id: str, timeout: int = 120, progress_callback=None
    ):
        """Wait for a Hypha service to be registered and available."""
        try:
            from hypha_rpc import connect_to_server

            # Connect to Hypha server to check for service
            server = await connect_to_server(server_url=self.server_url)

            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    # Try to get the service
                    service = await server.get_service(f"{workspace}/{service_id}")
                    if service:
                        if progress_callback:
                            progress_callback({
                                "type": "success",
                                "message": f"Service '{service_id}' is now available"
                            })
                        return True
                except Exception:
                    # Service not yet available
                    await asyncio.sleep(2)

            # Timeout
            if progress_callback:
                progress_callback({
                    "type": "warning",
                    "message": f"Service '{service_id}' did not become available within {timeout}s"
                })
            return False

        except Exception as e:
            logger.warning(f"Could not check for Hypha service: {e}")
            return False

    async def _start_k8s_job(
        self, config: WorkerConfig, session_id: str, progress_callback=None
    ) -> Dict[str, Any]:
        """Start a regular Kubernetes job session."""
        logs = {
            "stdout": [],
            "stderr": [],
            "info": [f"Kubernetes job session started successfully"],
            "error": [],
            "progress": [],
        }

        def progress_callback_wrapper(message):
            logs["progress"].append(f"{message['type'].upper()}: {message['message']}")
            if progress_callback:
                progress_callback(message)

        # Extract job specification from manifest
        manifest = config.manifest
        image = manifest["image"]
        command = manifest.get("command", [])
        env = manifest.get("env") or {}
        image_pull_policy = manifest.get("image_pull_policy", self.image_pull_policy)
        restart_policy = manifest.get("restart_policy", "Never")
        timeout = manifest.get("timeout", self.default_timeout)

        progress_callback_wrapper(
            {"type": "info", "message": f"Creating Kubernetes job with image: {image}"}
        )
        job_name = to_k8s_job_name(session_id)

        # Build environment variables - include Hypha configuration automatically
        env_vars = []

        # Add Hypha environment variables automatically
        hypha_env = {
            "HYPHA_SERVER_URL": config.server_url or self.server_url,
            "HYPHA_WORKSPACE": config.workspace,
            "HYPHA_CLIENT_ID": config.client_id,
            "HYPHA_TOKEN": config.token,
            "HYPHA_APP_ID": config.app_id,
        }

        # Merge with user-provided environment variables (user variables take precedence)
        merged_env = {**hypha_env, **env}

        for key, value in merged_env.items():
            env_vars.append(client.V1EnvVar(name=key, value=str(value)))

        # Create container spec with security context
        container = client.V1Container(
            name="main",
            image=image,
            command=command if command else None,
            env=env_vars,
            image_pull_policy=image_pull_policy,
            security_context=client.V1SecurityContext(
                allow_privilege_escalation=False,
                capabilities=client.V1Capabilities(drop=["ALL"]),
                run_as_non_root=True,
                seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
            ),
        )

        # Create pod spec with security context
        pod_spec = client.V1PodSpec(
            containers=[container],
            restart_policy=restart_policy,
            service_account_name="default",
            security_context=client.V1PodSecurityContext(
                run_as_user=1000,
                run_as_non_root=True,
                fs_group=1000,
                seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
            ),
        )

        # Create job metadata
        job_metadata = client.V1ObjectMeta(
            name=job_name,
            labels={
                "app": "hypha",
                "component": "worker-job",
            },
            annotations={
                "hypha.amun.ai/app-id": config.app_id,
                "hypha.amun.ai/workspace": config.workspace,
                "hypha.amun.ai/client-id": config.client_id,
                "hypha.amun.ai/session-id": session_id,
                "hypha.amun.ai/created-at": datetime.now().isoformat(),
                "hypha.amun.ai/worker-type": "k8s",
            },
        )

        # Create pod template
        pod_template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={
                    "app": "hypha",
                    "component": "worker-job",
                }
            ),
            spec=pod_spec,
        )

        # Create job spec
        job_spec = client.V1JobSpec(
            template=pod_template,
            backoff_limit=3,
        )

        # Create job
        job = client.V1Job(
            api_version="batch/v1",
            kind="Job",
            metadata=job_metadata,
            spec=job_spec,
        )

        try:
            # Create the job in Kubernetes
            self.batch_v1.create_namespaced_job(namespace=self.namespace, body=job)

            progress_callback_wrapper(
                {
                    "type": "success",
                    "message": f"Job {job_name} created successfully",
                }
            )

            # Wait for job pod to be running
            progress_callback_wrapper(
                {"type": "info", "message": "Waiting for job pod to start..."}
            )

            start_time = time.time()
            max_wait_time = 300  # 5 minutes
            pod_name = None

            while time.time() - start_time < max_wait_time:
                try:
                    # Get pods created by this job
                    pods = self.v1.list_namespaced_pod(
                        namespace=self.namespace,
                        label_selector=f"job-name={job_name}"
                    )

                    if pods.items:
                        pod = pods.items[0]
                        pod_name = pod.metadata.name
                        phase = pod.status.phase

                        if phase == "Running":
                            progress_callback_wrapper(
                                {
                                    "type": "success",
                                    "message": f"Pod {pod_name} is now running",
                                }
                            )
                            break
                        elif phase == "Failed":
                            raise WorkerError(f"Pod {pod_name} failed to start")
                        elif phase == "Succeeded":
                            progress_callback_wrapper(
                                {
                                    "type": "info",
                                    "message": f"Pod {pod_name} completed immediately",
                                }
                            )
                            break

                    await asyncio.sleep(2)

                except ApiException as e:
                    if e.status == 404:
                        await asyncio.sleep(2)
                        continue
                    raise

            else:
                raise WorkerError(f"Timeout waiting for job {job_name} pod to start")

        except ApiException as e:
            progress_callback_wrapper(
                {
                    "type": "error",
                    "message": f"Kubernetes API error: {str(e)}",
                }
            )
            raise WorkerError(f"Failed to create job: {str(e)}")

        return {
            "job_name": job_name,
            "pod_name": pod_name,
            "image": image,
            "command": command,
            "env": merged_env,
            "logs": logs,
            "timeout": timeout,
        }

    @schema_method
    async def stop(
        self,
        session_id: str = Field(..., description="The session ID to stop."),
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Stop a Kubernetes job session."""
        if session_id not in self._sessions:
            logger.warning(f"Kubernetes job session {session_id} not found for stopping")
            return

        session_info = self._sessions[session_id]
        session_info.status = SessionStatus.STOPPING

        try:
            session_data = self._session_data.get(session_id)
            if session_data:
                job_name = session_data["job_name"]
                logger.info(f"Stopping Kubernetes job {job_name} for session {session_id}")

                try:
                    self.batch_v1.delete_namespaced_job(
                        name=job_name,
                        namespace=self.namespace,
                        body=client.V1DeleteOptions(propagation_policy="Background"),
                    )
                    logger.info(f"Successfully deleted job {job_name}")
                except ApiException as e:
                    if e.status == 404:
                        logger.warning(f"Job {job_name} was already deleted")
                    else:
                        raise WorkerError(f"Failed to delete job {job_name}: {str(e)}")

            session_info.status = SessionStatus.STOPPED
            logger.info(f"Stopped Kubernetes job session {session_id}")

        except Exception as e:
            session_info.status = SessionStatus.FAILED
            session_info.error = str(e)
            logger.error(f"Failed to stop Kubernetes job session {session_id}: {e}")
            raise
        finally:
            # Cleanup
            self._sessions.pop(session_id, None)
            self._session_data.pop(session_id, None)

    async def list_sessions(
        self, workspace: str, context: Optional[Dict[str, Any]] = None
    ) -> List[SessionInfo]:
        """List all Kubernetes job sessions for a workspace."""
        return [
            session_info
            for session_info in self._sessions.values()
            if session_info.workspace == workspace
        ]

    async def get_session_info(
        self, session_id: str, context: Optional[Dict[str, Any]] = None
    ) -> SessionInfo:
        """Get information about a Kubernetes job session."""
        if session_id not in self._sessions:
            raise SessionNotFoundError(f"Kubernetes job session {session_id} not found")
        return self._sessions[session_id]

    @schema_method
    async def get_logs(
        self,
        session_id: str = Field(..., description="The session ID to get logs from."),
        type: Optional[str] = Field(None, description="Filter logs by type."),
        offset: int = Field(0, description="Pagination offset."),
        limit: Optional[int] = Field(None, description="Maximum number of log entries."),
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Get logs for a Kubernetes job session."""
        if session_id not in self._sessions:
            raise SessionNotFoundError(f"Kubernetes job session {session_id} not found")

        session_data = self._session_data.get(session_id)
        if not session_data:
            return {"items": [], "total": 0, "offset": offset, "limit": limit}

        # Try to get real-time logs from Kubernetes
        pod_name = session_data.get("pod_name")
        if pod_name:
            try:
                k8s_logs = self.v1.read_namespaced_pod_log(
                    name=pod_name, namespace=self.namespace, container="main"
                )

                if k8s_logs:
                    logs = session_data.get("logs", {})
                    logs.setdefault("stdout", []).append(k8s_logs)

            except ApiException as e:
                logger.warning(f"Could not fetch logs for pod {pod_name}: {e}")

        logs = session_data.get("logs", {})

        # Convert logs to items format
        all_items = []
        for log_type, log_entries in logs.items():
            for entry in log_entries:
                all_items.append({"type": log_type, "content": entry})

        # Filter by type if specified
        if type:
            filtered_items = [item for item in all_items if item["type"] == type]
        else:
            filtered_items = all_items

        total = len(filtered_items)

        # Apply pagination
        if limit is None:
            paginated_items = filtered_items[offset:]
        else:
            paginated_items = filtered_items[offset:offset + limit]

        return {
            "items": paginated_items,
            "total": total,
            "offset": offset,
            "limit": limit
        }

    @schema_method
    async def execute(
        self,
        session_id: str = Field(..., description="The session ID to execute the command in."),
        script: str = Field(..., description="The script or command to execute."),
        config: Optional[Dict[str, Any]] = Field(None, description="Optional execution configuration."),
        progress_callback: Optional[Any] = Field(None, description="Optional callback function."),
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Execute a script in the running job pod."""
        if session_id not in self._sessions:
            raise SessionNotFoundError(f"Kubernetes job session {session_id} not found")

        session_data = self._session_data.get(session_id)
        if not session_data:
            raise WorkerError(f"No pod data available for session {session_id}")

        pod_name = session_data.get("pod_name")
        if not pod_name:
            raise WorkerError(f"No pod name found for session {session_id}")

        await safe_call_callback(progress_callback,
            {"type": "info", "message": f"Executing command in pod {pod_name}..."}
        )

        try:
            timeout = config.get("timeout", 30) if config else 30
            container_name = config.get("container", "main") if config else "main"
            shell = config.get("shell", "/bin/sh") if config else "/bin/sh"

            # Prepare command
            if '\n' in script or ';' in script or '|' in script or '&&' in script:
                command = [shell, "-c", script]
            else:
                command = script.strip().split()

            logger.info(f"Executing command in pod {pod_name}: {command}")

            try:
                exec_output = stream(
                    self.v1.connect_get_namespaced_pod_exec,
                    name=pod_name,
                    namespace=self.namespace,
                    container=container_name,
                    command=command,
                    stderr=True,
                    stdin=False,
                    stdout=True,
                    tty=False,
                    _preload_content=False
                )

                stdout_lines = []
                stderr_lines = []

                start_time = time.time()
                while exec_output.is_open():
                    exec_output.update(timeout=1)

                    if time.time() - start_time > timeout:
                        exec_output.close()
                        raise asyncio.TimeoutError(f"Command execution timed out after {timeout} seconds")

                    if exec_output.peek_stdout():
                        stdout_lines.append(exec_output.read_stdout())
                    if exec_output.peek_stderr():
                        stderr_lines.append(exec_output.read_stderr())

                return_code = exec_output.returncode if hasattr(exec_output, 'returncode') else None
                stdout_text = ''.join(stdout_lines).rstrip('\n')
                stderr_text = ''.join(stderr_lines).rstrip('\n')

                outputs = []
                if stdout_text:
                    outputs.append({"type": "stream", "name": "stdout", "text": stdout_text})
                if stderr_text:
                    outputs.append({"type": "stream", "name": "stderr", "text": stderr_text})

                logs = session_data.get("logs", {})
                if stdout_text:
                    logs.setdefault("stdout", []).append(stdout_text)
                if stderr_text:
                    logs.setdefault("stderr", []).append(stderr_text)

                success = return_code == 0 if return_code is not None else True
                status_text = "success" if success else "error"
                logs.setdefault("info", []).append(
                    f"Command executed at {datetime.now().isoformat()} - Status: {status_text}"
                )

                await safe_call_callback(progress_callback,
                    {"type": "success" if success else "error",
                     "message": "Command executed successfully" if success else f"Command failed with return code: {return_code}"}
                )

                result = {"status": "ok" if success else "error", "outputs": outputs}

                if not success and return_code is not None:
                    result["error"] = {
                        "ename": "CommandError",
                        "evalue": f"Command failed with return code {return_code}",
                        "traceback": [stderr_text] if stderr_text else [f"Command failed with return code {return_code}"]
                    }

                return result

            except ApiException as e:
                error_msg = f"Kubernetes API error during command execution: {str(e)}"
                logger.error(f"Failed to execute command in pod {pod_name}: {e}")
                await safe_call_callback(progress_callback, {"type": "error", "message": error_msg})

                logs = session_data.get("logs", {})
                logs.setdefault("error", []).append(error_msg)

                return {
                    "status": "error",
                    "outputs": [],
                    "error": {"ename": "KubernetesApiError", "evalue": str(e), "traceback": [error_msg]}
                }

        except asyncio.TimeoutError as e:
            error_msg = str(e)
            await safe_call_callback(progress_callback, {"type": "error", "message": error_msg})
            return {
                "status": "error",
                "outputs": [],
                "error": {"ename": "TimeoutError", "evalue": error_msg, "traceback": [error_msg]}
            }
        except Exception as e:
            error_msg = f"Failed to execute command: {str(e)}"
            logger.error(f"Failed to execute command in session {session_id}: {e}")
            await safe_call_callback(progress_callback, {"type": "error", "message": error_msg})
            return {
                "status": "error",
                "outputs": [],
                "error": {"ename": type(e).__name__, "evalue": str(e), "traceback": [error_msg]}
            }

    @schema_method
    async def shutdown(
        self,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Shutdown the Kubernetes worker."""
        logger.info("Shutting down Kubernetes worker...")

        session_ids = list(self._sessions.keys())
        for session_id in session_ids:
            try:
                await self.stop(session_id)
            except Exception as e:
                logger.warning(f"Failed to stop Kubernetes job session {session_id}: {e}")

        logger.info("Kubernetes worker shutdown complete")


async def hypha_startup(server):
    """Hypha startup function to initialize Kubernetes worker."""
    namespace = os.environ.get("HYPHA_K8S_NAMESPACE", "default")
    default_timeout = int(os.environ.get("HYPHA_K8S_DEFAULT_TIMEOUT", "3600"))
    image_pull_policy = os.environ.get("HYPHA_K8S_IMAGE_PULL_POLICY", "IfNotPresent")
    server_url = os.environ.get("HYPHA_SERVER_URL", "https://hypha.aicell.io")

    try:
        worker = KubernetesWorker(
            namespace=namespace,
            default_timeout=default_timeout,
            image_pull_policy=image_pull_policy,
            server_url=server_url,
        )
        await worker.register_worker_service(server)
        logger.info(f"Kubernetes worker initialized and registered for namespace: {namespace}")
    except WorkerNotAvailableError as e:
        logger.error(f"Kubernetes worker not available: {e}")
        logger.info("Skipping Kubernetes worker registration")
    except Exception as e:
        logger.error(f"Failed to initialize Kubernetes worker: {e}")
        raise


def main():
    """Main function for command line execution."""
    import argparse

    def get_env_var(name: str, default: str = None) -> str:
        return os.environ.get(f"HYPHA_{name.upper()}", default)

    parser = argparse.ArgumentParser(
        description="Hypha Kubernetes Worker - Launch jobs in Kubernetes clusters",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment Variables (with HYPHA_ prefix):
  HYPHA_SERVER_URL         Hypha server URL (e.g., https://hypha.aicell.io)
  HYPHA_WORKSPACE          Workspace name
  HYPHA_TOKEN              Authentication token
  HYPHA_SERVICE_ID         Service ID for the worker (optional)
  HYPHA_VISIBILITY         Service visibility: public or protected (default: protected)
  HYPHA_K8S_NAMESPACE      Kubernetes namespace (default: default)
  HYPHA_K8S_DEFAULT_TIMEOUT Default timeout for jobs in seconds (default: 3600)
  HYPHA_K8S_IMAGE_PULL_POLICY Image pull policy (default: IfNotPresent)

Examples:
  python -m k8s --server-url https://hypha.aicell.io --workspace my-workspace --token TOKEN
        """,
    )

    parser.add_argument("--server-url", type=str, default=get_env_var("SERVER_URL"), help="Hypha server URL")
    parser.add_argument("--workspace", type=str, default=get_env_var("WORKSPACE"), help="Workspace name")
    parser.add_argument("--token", type=str, default=get_env_var("TOKEN"), help="Authentication token")
    parser.add_argument("--service-id", type=str, default=get_env_var("SERVICE_ID"), help="Service ID")
    parser.add_argument("--visibility", type=str, choices=["public", "protected"], default=get_env_var("VISIBILITY", "protected"))
    parser.add_argument("--client-id", type=str, default=get_env_var("CLIENT_ID"))
    parser.add_argument("--disable-ssl", action="store_true", help="Disable SSL verification")
    parser.add_argument("--namespace", type=str, default=get_env_var("K8S_NAMESPACE", "default"))
    parser.add_argument("--default-timeout", type=int, default=int(get_env_var("K8S_DEFAULT_TIMEOUT", "3600")))
    parser.add_argument("--image-pull-policy", type=str, choices=["Always", "IfNotPresent", "Never"], default=get_env_var("K8S_IMAGE_PULL_POLICY", "IfNotPresent"))
    parser.add_argument("--verbose", "-v", action="store_true")

    args = parser.parse_args()

    if not all([args.server_url, args.workspace, args.token]):
        print("Error: --server-url, --workspace, and --token are required", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        logger.setLevel(logging.INFO)

    print(f"Starting Hypha Kubernetes Worker...")
    print(f"  Server URL: {args.server_url}")
    print(f"  Workspace: {args.workspace}")
    print(f"  Namespace: {args.namespace}")

    async def run_worker():
        try:
            from hypha_rpc import connect_to_server

            server = await connect_to_server(
                server_url=args.server_url,
                workspace=args.workspace,
                token=args.token,
                client_id=args.client_id,
                ssl=False if args.disable_ssl else None,
            )

            worker = KubernetesWorker(
                namespace=args.namespace,
                default_timeout=args.default_timeout,
                image_pull_policy=args.image_pull_policy,
                server_url=args.server_url,
            )

            service_config = worker.get_worker_service()
            if args.service_id:
                service_config["id"] = args.service_id
            service_config["config"]["visibility"] = args.visibility

            print(f"🔄 Registering Kubernetes worker...")
            registration_result = await server.register_service(service_config)
            print(f"✅ Kubernetes Worker registered: {registration_result.id}")
            print(f"   Supported types: {worker.supported_types}")
            print(f"   Namespace: {args.namespace}")
            print(f"")
            print(f"Worker is ready to process Kubernetes job requests...")
            print(f"Press Ctrl+C to stop the worker.")

            try:
                while True:
                    await asyncio.sleep(1)
            except KeyboardInterrupt:
                print(f"\n🛑 Shutting down Kubernetes Worker...")
                await worker.shutdown()
                print(f"✅ Worker shutdown complete.")

        except Exception as e:
            print(f"❌ Failed to start Kubernetes Worker: {e}", file=sys.stderr)
            sys.exit(1)

    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
