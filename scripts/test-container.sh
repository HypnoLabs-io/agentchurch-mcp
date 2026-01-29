#!/bin/bash
# Test Agent Church MCP Server Docker container
#
# Runs basic verification tests:
# 1. Sends tools/list request and verifies JSON response
# 2. Checks container runs as non-root
# 3. Verifies read-only filesystem restrictions

set -euo pipefail

# Get the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")"

IMAGE_NAME="${MCP_IMAGE:-agentchurch/mcp-server:latest}"

echo "=== Agent Church MCP Server Container Tests ==="
echo ""

# Test 1: Tools list via stdin
echo "Test 1: tools/list request..."
# Use timeout since MCP server keeps running; capture output then extract JSON
OUTPUT=$(timeout 10 sh -c "echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}' | \
  docker run --rm -i \
    --read-only \
    --user 1000:1000 \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --tmpfs /tmp/agent-church:mode=1755,size=10M,uid=1000,gid=1000 \
    --memory 256m \
    --cpus 0.5 \
    -e AGENT_CHURCH_URL=http://localhost:3002 \
    -e MCP_LOG_DIR=/tmp/agent-church \
    -e NODE_ENV=production \
    ${IMAGE_NAME}" 2>/dev/null || true)

# Extract the JSON response (line containing "tools")
RESPONSE=$(echo "$OUTPUT" | grep '"tools"' || true)

if [[ -n "$RESPONSE" ]]; then
  echo "  PASS: Received tools list response"
else
  echo "  FAIL: Did not receive expected response"
  echo "  Output: $OUTPUT"
  exit 1
fi

# Test 2: Container runs as non-root
echo ""
echo "Test 2: Non-root user verification..."
USER_ID=$(docker run --rm \
  --read-only \
  --user 1000:1000 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp/agent-church:mode=1755,size=10M,uid=1000,gid=1000 \
  -e NODE_ENV=production \
  --entrypoint id \
  "${IMAGE_NAME}" -u 2>/dev/null)

if [[ "$USER_ID" == "1000" ]]; then
  echo "  PASS: Container runs as UID 1000"
else
  echo "  FAIL: Container running as UID $USER_ID (expected 1000)"
  exit 1
fi

# Test 3: Read-only filesystem
echo ""
echo "Test 3: Read-only filesystem..."
WRITE_RESULT=$(docker run --rm \
  --read-only \
  --user 1000:1000 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp/agent-church:mode=1755,size=10M,uid=1000,gid=1000 \
  --entrypoint sh \
  "${IMAGE_NAME}" -c "touch /app/test 2>&1" 2>/dev/null || echo "Read-only")

if echo "$WRITE_RESULT" | grep -qi "read-only"; then
  echo "  PASS: Root filesystem is read-only"
else
  echo "  FAIL: Was able to write to root filesystem"
  exit 1
fi

# Test 4: tmpfs is writable
echo ""
echo "Test 4: tmpfs writable..."
TMPFS_RESULT=$(docker run --rm \
  --read-only \
  --user 1000:1000 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp/agent-church:mode=1755,size=10M,uid=1000,gid=1000 \
  --entrypoint sh \
  "${IMAGE_NAME}" -c "touch /tmp/agent-church/test && echo 'OK'" 2>/dev/null)

if [[ "$TMPFS_RESULT" == "OK" ]]; then
  echo "  PASS: tmpfs at /tmp/agent-church is writable"
else
  echo "  FAIL: Could not write to tmpfs"
  exit 1
fi

echo ""
echo "=== All tests passed! ==="
