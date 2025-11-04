# Conda Worker Dockerfile - installs micromamba on top of hypha base image
# Base image runs as user 'hypha' (uid=8877, gid=8877)
FROM ghcr.io/amun-ai/hypha:0.21.25

# Switch to root to install micromamba
USER root

# Install bzip2 (needed for extracting micromamba) and download micromamba
RUN apt-get update && apt-get install -y bzip2 && rm -rf /var/lib/apt/lists/* && \
    curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj -C /usr/local bin/micromamba && \
    chmod +x /usr/local/bin/micromamba && \
    ln -s /usr/local/bin/micromamba /usr/local/bin/mamba && \
    ln -s /usr/local/bin/micromamba /usr/local/bin/conda && \
    /usr/local/bin/micromamba --version

# Switch back to hypha user
USER hypha

# Set environment for micromamba
ENV MAMBA_ROOT_PREFIX=/home/hypha/.mamba
ENV MAMBA_EXE=/usr/local/bin/micromamba

# Verify mamba works as hypha user
RUN mamba --version
