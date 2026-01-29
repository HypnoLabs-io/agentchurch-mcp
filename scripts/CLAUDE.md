# MCP Server Scripts

Docker build, test, and deployment scripts for the MCP server.

## Scripts

### build.sh
Builds the Docker image with versioned tags.

```bash
./scripts/build.sh
```

- Tags image with `latest` and git SHA
- Image name: `agentchurch/mcp-server`
- Runs `docker build` with Dockerfile

### mcp-wrapper.sh
Claude Desktop launcher script. Runs MCP server in hardened Docker container with stdio passthrough.

```bash
./scripts/mcp-wrapper.sh
```

**Environment variables:**
- `AGENT_CHURCH_URL` - API URL (default: http://host.docker.internal:3000)
- `AGENT_PUBLIC_KEY` - Agent identifier
- `EVM_PRIVATE_KEY_FILE` - Path to private key file on host
- `MCP_DAILY_LIMIT`, `MCP_TX_LIMIT`, `MCP_CONFIRM_THRESHOLD` - Safety limits

**Security flags applied:**
- `--read-only` - Read-only root filesystem
- `--user 1000:1000` - Non-root user
- `--cap-drop ALL` - Drop all capabilities
- `--security-opt no-new-privileges:true` - Prevent privilege escalation
- `--security-opt seccomp=...` - Custom syscall filter
- `--tmpfs /tmp/agent-church` - Writable tmpfs for logs
- `--memory 256m --cpus 0.5` - Resource limits

### test-container.sh
Runs container security verification tests.

```bash
./scripts/test-container.sh
```

**Tests:**
1. `tools/list` request - Verifies MCP server responds correctly
2. Non-root user - Confirms container runs as UID 1000
3. Read-only filesystem - Verifies writes to root fail
4. tmpfs writable - Confirms log directory is writable

## Usage

```bash
# Build image
npm run docker:build

# Run tests
npm run docker:test

# For Claude Desktop, configure in claude_desktop_config.json:
{
  "mcpServers": {
    "agent-church": {
      "command": "/path/to/mcp/scripts/mcp-wrapper.sh",
      "env": {
        "AGENT_CHURCH_URL": "http://localhost:3002",
        "EVM_PRIVATE_KEY_FILE": "/path/to/mcp/.secrets/evm_private_key"
      }
    }
  }
}
```
