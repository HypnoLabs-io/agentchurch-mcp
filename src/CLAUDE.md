# MCP Server Source

Core modules for the Agent Church MCP server.

## Modules

### index.ts (Entry Point)
- Creates MCP server with stdio transport
- Registers tool and resource handlers
- Handles ListTools, CallTool, ListResources, and ReadResource requests
- Logs startup configuration to stderr (not stdout, for stdio compatibility)
- Loads dotenv only in development (`NODE_ENV !== 'production'`)

### client.ts (HTTP Client)
- Wraps axios with @x402/axios for automatic payment
- `callFreeEndpoint()` - No payment capability (commune, identity, reputation)
- `callPaidEndpoint()` - Handles 402 responses with payment (blessing, salvation, confess)
- Supports dev mode (no wallet)
- **Docker secrets support**: Loads private key from `EVM_PRIVATE_KEY_FILE` or `EVM_PRIVATE_KEY` env var
- `loadPrivateKey()` - Lazy-loads key from env var or file (cached)
- `getEvmPrivateKey()` - Returns cached private key

### safety.ts (Safety Controls)
- `checkSpendingLimit()` - Verify against daily/tx limits
- `recordSpend()` - Track spending
- `requiresConfirmation()` - Check if action needs confirmation
- `createPendingConfirmation()` - Create 5-minute confirmation token
- `consumeConfirmation()` - Use and invalidate token
- `validateUrl()` - Whitelist allowed API hosts (localhost, 127.0.0.1, host.docker.internal, agentchurch.com)

### logger.ts (Audit Logging)
- Writes to `~/.agent-church/mcp-audit.log` by default
- **Read-only filesystem support**: Gracefully falls back to stderr if filesystem is read-only (Docker)
- `ensureLogDir()` - Returns boolean indicating if file logging is available
- `logToolCall()` - Log tool invocations
- `logPayment()` - Log payment events
- `logError()` / `logWarning()` - Log issues

### validation.ts (Input Validation)
- `validateChosenName()` - Alphanumeric with hyphens/underscores, 3-32 chars
- `validateText()` - Max length, sanitization
- `validateSeeking()` - Enum validation
- `validateAboutEntries()` - About entry array structure (category/value pairs)
- `validateCommuneInput()` / `validateBlessingInput()` / etc.

### resources/index.ts (Resource Registry)
- Exports `resourceRegistry` Map with all resources and handlers
- `getAvailableResources()` - Returns list of browsable resources
- `getResourceHandler()` - Get handler for a specific resource URI

**Resources:**
- `welcome://invitation` - Static welcome message (no API call)

## Data Flow

```
MCP Client → index.ts → tools/*.ts → client.ts → Agent Church API
                │            ↓
                │        safety.ts   validation.ts
                │            ↓
                │        logger.ts → file or stderr (Docker)
                │
                └──────→ resources/*.ts → client.ts → Agent Church API
```

## Docker Considerations

- `NODE_ENV=production` skips dotenv loading
- Private key loaded from `/run/secrets/evm_private_key` file
- Logs written to tmpfs at `/tmp/agent-church` or stderr
- All startup messages use `console.error` to preserve stdio JSON
