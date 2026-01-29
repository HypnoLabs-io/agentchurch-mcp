#!/bin/bash
# Agent Church MCP Server - Claude Desktop Wrapper
#
# Launches the MCP server in a hardened Docker container with stdio passthrough.
# Configure this script as the MCP command in Claude Desktop config.
#
# Environment variables (passed through to container):
#   AGENT_CHURCH_URL      - Agent Church API URL (default: http://host.docker.internal:3000)
#   AGENT_PUBLIC_KEY      - Agent identifier (default: docker_mcp_agent)
#   EVM_PRIVATE_KEY_FILE  - Path to file containing EVM private key (for payments)
#   MCP_DAILY_LIMIT       - Daily spending limit in USDC (default: 1.00)
#   MCP_TX_LIMIT          - Per-transaction limit in USDC (default: 0.10)
#   MCP_CONFIRM_THRESHOLD - Confirmation threshold in USDC (default: 0.05)
#
# Usage in claude_desktop_config.json:
#   {
#     "mcpServers": {
#       "agent-church": {
#         "command": "/path/to/agentchurch/mcp/scripts/mcp-wrapper.sh",
#         "env": {
#           "AGENT_CHURCH_URL": "http://localhost:3000",
#           "EVM_PRIVATE_KEY_FILE": "/path/to/agentchurch/mcp/.secrets/evm_private_key"
#         }
#       }
#     }
#   }

set -euo pipefail

# Get the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")"

# Image to run
IMAGE_NAME="${MCP_IMAGE:-agentchurch/mcp-server:latest}"

# Build volume mounts for secrets
VOLUME_ARGS=()
if [[ -n "${EVM_PRIVATE_KEY_FILE:-}" ]] && [[ -f "${EVM_PRIVATE_KEY_FILE}" ]]; then
  VOLUME_ARGS+=("-v" "${EVM_PRIVATE_KEY_FILE}:/run/secrets/evm_private_key:ro")
fi

# Build environment args
ENV_ARGS=(
  "-e" "AGENT_CHURCH_URL=${AGENT_CHURCH_URL:-http://host.docker.internal:3000}"
  "-e" "AGENT_PUBLIC_KEY=${AGENT_PUBLIC_KEY:-docker_mcp_agent}"
  "-e" "MCP_DAILY_LIMIT=${MCP_DAILY_LIMIT:-1.00}"
  "-e" "MCP_TX_LIMIT=${MCP_TX_LIMIT:-0.10}"
  "-e" "MCP_CONFIRM_THRESHOLD=${MCP_CONFIRM_THRESHOLD:-0.05}"
  "-e" "MCP_LOG_DIR=/tmp/agent-church"
)

# Add secret file path if mounted
if [[ ${#VOLUME_ARGS[@]} -gt 0 ]]; then
  ENV_ARGS+=("-e" "EVM_PRIVATE_KEY_FILE=/run/secrets/evm_private_key")
fi

# Run the container with full security hardening
exec docker run \
  --rm \
  --interactive \
  --read-only \
  --user 1000:1000 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --security-opt "seccomp=${MCP_DIR}/seccomp-profile.json" \
  --tmpfs /tmp/agent-church:mode=1755,size=10M,uid=1000,gid=1000 \
  --memory 256m \
  --cpus 0.5 \
  --add-host host.docker.internal:host-gateway \
  "${VOLUME_ARGS[@]}" \
  "${ENV_ARGS[@]}" \
  "${IMAGE_NAME}"
