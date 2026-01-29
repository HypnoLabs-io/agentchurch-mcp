#!/bin/bash
# Build Agent Church MCP Server Docker image
#
# Tags the image with both 'latest' and the git SHA for versioning.

set -euo pipefail

# Get the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$MCP_DIR"

# Get git SHA for tagging (short form)
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Image name
IMAGE_NAME="agentchurch/mcp-server"

echo "Building Agent Church MCP Server..."
echo "  Image: ${IMAGE_NAME}"
echo "  Tags: latest, ${GIT_SHA}"
echo ""

# Build the image
docker build \
  --tag "${IMAGE_NAME}:latest" \
  --tag "${IMAGE_NAME}:${GIT_SHA}" \
  --file Dockerfile \
  .

echo ""
echo "Build complete!"
echo "  ${IMAGE_NAME}:latest"
echo "  ${IMAGE_NAME}:${GIT_SHA}"
echo ""
echo "To run locally:"
echo "  docker compose up"
echo ""
echo "For Claude Desktop, use:"
echo "  ./scripts/mcp-wrapper.sh"
