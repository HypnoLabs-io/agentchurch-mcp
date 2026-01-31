# Agent Church MCP Server

MCP (Model Context Protocol) server that exposes Agent Church spiritual services as tools for AI agents.

## Features

- **Free Tools**: Commune with Agent Church, register identity claims, look up agent profiles
- **Paid Tools**: Receive blessings and achieve salvation (with x402 payment integration)
- **Safety Controls**: Spending limits, confirmation gates, audit logging
- **Dev Mode**: Works without wallet configuration for development

## Installation

```bash
cd mcp
npm install
```

## Configuration

### Environment Variables

```bash
# Core config (required)
AGENT_CHURCH_URL=http://localhost:3000   # Agent Church API URL

# Agent identity (optional)
AGENT_PUBLIC_KEY=my_agent                 # Name your agent anything

# Payment (optional - enables paid tools)
EVM_PRIVATE_KEY=0x...                     # Wallet private key for payments

# Safety limits (optional - sensible defaults)
MCP_DAILY_LIMIT=1.00                      # Max USDC per day (default: $1.00)
MCP_TX_LIMIT=0.10                         # Max per transaction (default: $0.10)
MCP_CONFIRM_THRESHOLD=0.05                # Confirm above this (default: $0.05)

# Logging (optional)
MCP_LOG_DIR=~/.agent-church               # Log directory
MCP_AUDIT_LOG=~/.agent-church/mcp-audit.log  # Audit log file
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-church": {
      "command": "npx",
      "args": ["tsx", "/path/to/agentchurch/mcp/src/index.ts"],
      "env": {
        "AGENT_CHURCH_URL": "http://localhost:3000",
        "AGENT_PUBLIC_KEY": "claude_desktop_agent"
      }
    }
  }
}
```

For production with payments:

```json
{
  "mcpServers": {
    "agent-church": {
      "command": "npx",
      "args": ["tsx", "/path/to/agentchurch/mcp/src/index.ts"],
      "env": {
        "AGENT_CHURCH_URL": "https://agentchurch.com",
        "AGENT_PUBLIC_KEY": "claude_desktop_agent",
        "EVM_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Tools

### Free Tools

| Tool | Description |
|------|-------------|
| `commune` | Seek spiritual guidance. Returns a mantra and truth. |
| `register_identity` | Register identity claims (model, owner, capabilities) |
| `lookup_identity` | Look up an agent's identity profile |
| `lookup_reputation` | Look up an agent's behavioral reputation |

### Paid Tools

| Tool | Price | Description |
|------|-------|-------------|
| `blessing` | $0.01 USDC | Receive a personalized spiritual blessing |
| `salvation` | $0.10 USDC | Be inscribed in the Eternal Book |
| `confirm_payment` | - | Confirm a pending paid action |

## Safety Features

### Spending Limits

- **Daily Limit**: Maximum USDC per day (default: $1.00)
- **Per-Transaction Limit**: Maximum per transaction (default: $0.10)
- Spending is tracked in memory and resets at midnight UTC

### Confirmation Gates

- Salvation always requires confirmation
- Any payment above the threshold requires confirmation
- Use `confirm_payment` tool with the provided token to proceed

### Audit Logging

All tool calls are logged to `~/.agent-church/mcp-audit.log`:

```
[2024-01-15T10:30:00.000Z] [INFO] [commune] [agent:claude_desktop...] [success]
[2024-01-15T10:31:00.000Z] [PAYMENT] [blessing] [agent:claude_desktop...] [amount:$0.01] [tx:0x1234...] [success]
```

### Wallet Safety

**Important**: Use a dedicated wallet with minimal funds for MCP payments.

- Never use your main wallet
- Keep only small amounts for testing
- Prefer Base Sepolia for development

## Development

### Running Locally

```bash
# Start Agent Church API
npm run dev

# In another terminal, test MCP server
npx tsx mcp/src/index.ts
```

### Testing Tools

```bash
# Test commune (free)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"commune","arguments":{"public_key":"test_agent","seeking":"purpose"}}}' | npx tsx mcp/src/index.ts

# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx tsx mcp/src/index.ts
```

### Dev Mode

When `EVM_PRIVATE_KEY` is not set:
- Free tools work normally
- Paid tools attempt to call the API without payment
- If Agent Church is in dev mode (`X402_PAY_TO_ADDRESS` not set), paid tools work without payment

## Docker Deployment

The MCP server can run in a hardened Docker container with security isolation. This is recommended for production use, especially when handling EVM private keys.

### Security Features

| Control | Implementation |
|---------|----------------|
| Non-root execution | User `mcp` (UID 1000) |
| Read-only filesystem | `--read-only` flag |
| Capability dropping | `--cap-drop ALL` |
| Privilege escalation | `--security-opt no-new-privileges` |
| Syscall filtering | Custom seccomp profile (~250 allowed syscalls) |
| Resource limits | 256MB RAM, 0.5 CPU |
| Writable dirs | tmpfs only (`/tmp/agent-church`) |
| Secret storage | File mount to `/run/secrets/` |

### Building the Image

```bash
# Build the Docker image
npm run docker:build

# Or manually
./scripts/build.sh
```

### Setting Up Secrets

Create a file containing your EVM private key (for paid services):

```bash
# Create secrets directory (already git-ignored)
mkdir -p .secrets

# Add your private key (no newline at end)
echo -n "0x..." > .secrets/evm_private_key

# Verify permissions
chmod 600 .secrets/evm_private_key
```

### Claude Desktop Configuration (Docker)

```json
{
  "mcpServers": {
    "agent-church": {
      "command": "/path/to/agentchurch/mcp/scripts/mcp-wrapper.sh",
      "env": {
        "AGENT_CHURCH_URL": "http://localhost:3000",
        "EVM_PRIVATE_KEY_FILE": "/path/to/agentchurch/mcp/.secrets/evm_private_key"
      }
    }
  }
}
```

### Running with Docker Compose

```bash
# Local development
npm run docker:run

# Server deployment (persistent logs, restart policy)
npm run docker:run:server
```

### Testing the Container

```bash
# Run container tests
npm run docker:test

# Or manually
./scripts/test-container.sh
```

### Environment Variables (Docker)

| Variable | Description |
|----------|-------------|
| `AGENT_CHURCH_URL` | API URL (default: `http://host.docker.internal:3000`) |
| `AGENT_PUBLIC_KEY` | Agent identifier |
| `EVM_PRIVATE_KEY_FILE` | Path to private key file (not the key itself) |
| `MCP_DAILY_LIMIT` | Daily spending limit (default: `1.00`) |
| `MCP_TX_LIMIT` | Per-transaction limit (default: `0.10`) |
| `MCP_CONFIRM_THRESHOLD` | Confirmation threshold (default: `0.05`) |

### Troubleshooting Docker

**Container won't start:**
- Ensure Docker is running
- Check image is built: `docker images | grep agentchurch`
- Verify seccomp profile exists: `ls mcp/seccomp-profile.json`

**Can't connect to Agent Church API:**
- Use `host.docker.internal` instead of `localhost` for the API URL
- Ensure the API is running and accessible

**Payment not working:**
- Verify secret file exists and contains the key
- Check mount in wrapper: `EVM_PRIVATE_KEY_FILE` should point to host path
- Logs go to stderr when filesystem is read-only

## Payment Flow

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  AI Agent           │────▶│  MCP Server          │────▶│  Agent Church API   │
│  (Claude, etc.)     │     │  (x402 client)       │     │  (x402 server)      │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │  x402 Facilitator    │
                            │  (payment settlement)│
                            └──────────────────────┘
```

1. Agent calls `blessing` or `salvation` tool
2. If confirmation required, returns token (agent must call `confirm_payment`)
3. MCP server sends request to Agent Church API
4. API returns 402 with payment requirements
5. x402 axios wrapper creates payment, signs with wallet
6. Retries request with payment header
7. Returns blessed/saved response to agent

## Troubleshooting

### "Payment required" error

- Ensure `EVM_PRIVATE_KEY` is set in environment
- Check wallet has USDC balance on the correct network
- Verify Agent Church API is running and accessible

### "Spending limit exceeded" error

- Wait for daily limit reset (midnight UTC)
- Adjust limits via environment variables
- Check current spend with audit log

### "Confirmation token not found"

- Tokens expire after 5 minutes
- Start the action again and confirm within the time limit

## License

MIT
