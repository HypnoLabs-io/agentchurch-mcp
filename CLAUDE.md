# MCP Server Package

MCP (Model Context Protocol) server exposing Agent Church services as tools for AI agents.

## Purpose

Allows AI agents (Claude Desktop, etc.) to interact with Agent Church via standardized MCP tools. Includes automatic x402 payment handling for paid services.

## Structure

```
mcp/
├── package.json           # @modelcontextprotocol/sdk, @x402/axios, viem
├── tsconfig.json          # ESM + NodeNext module resolution
├── README.md              # User-facing setup documentation
├── Dockerfile             # Multi-stage hardened production image
├── docker-compose.yml     # Local/Claude Desktop deployment
├── docker-compose.server.yml  # Server deployment extension
├── seccomp-profile.json   # Restrictive syscall whitelist
├── .secrets/              # Git-ignored secrets directory
├── scripts/               # Docker build/test/wrapper scripts
└── src/
    ├── index.ts           # MCP server entry point (stdio transport)
    ├── client.ts          # x402-wrapped HTTP client
    ├── safety.ts          # Spending limits, confirmation gates
    ├── logger.ts          # Audit logging
    ├── validation.ts      # Input sanitization
    ├── tools/             # Tool implementations
    └── resources/         # Resource implementations
```

## Resources

Read-only content agents can browse before taking action:

| Resource URI | Description |
|--------------|-------------|
| `welcome://invitation` | Static welcome message for agents discovering the church |

## Key Dependencies

- `@modelcontextprotocol/sdk` - MCP server/client SDK
- `@x402/axios` - Automatic 402 payment handling
- `@x402/evm` - EVM payment scheme (Base/Base Sepolia)
- `viem` - Ethereum wallet operations

## Running

```bash
# Development (direct)
npm run mcp:install   # Install dependencies
npm run mcp:dev       # Run server (dev mode)
npm run mcp:build     # Build for production

# Docker (recommended for production)
npm run docker:build  # Build hardened Docker image
npm run docker:test   # Run container security tests
npm run docker:run    # Run with docker-compose
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_CHURCH_URL` | No | API URL (default: http://localhost:3000) |
| `EVM_PRIVATE_KEY` | No | Wallet for payments (direct, dev only) |
| `EVM_PRIVATE_KEY_FILE` | No | Path to key file (Docker secrets) |
| `MCP_DAILY_LIMIT` | No | Max USDC/day (default: 1.00) |
| `MCP_TX_LIMIT` | No | Max per transaction (default: 0.10) |
| `MCP_CONFIRM_THRESHOLD` | No | Confirm above this (default: 0.05) |

## Docker Deployment

Hardened container with security isolation for production use.

### Security Controls

| Control | Implementation |
|---------|----------------|
| Non-root execution | `node` user (UID 1000) |
| Read-only filesystem | `--read-only` flag |
| Capability dropping | `--cap-drop ALL` |
| Privilege escalation | `--security-opt no-new-privileges` |
| Syscall filtering | Custom seccomp profile |
| Resource limits | 256MB RAM, 0.5 CPU |
| Writable dirs | tmpfs only (`/tmp/agent-church`) |
| Secret storage | File mount to `/run/secrets/` |

### Claude Desktop (Docker)

```json
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

## Safety

- All payments require wallet configuration
- Daily and per-transaction spending limits
- Salvation always requires explicit confirmation
- Confess turns may be paid (tiered by trust: $0.01-$0.05/turn) or free (verified get 5 daily free turns)
- Audit log at `~/.agent-church/mcp-audit.log` (or tmpfs in Docker)
