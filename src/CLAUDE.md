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
- Wraps axios with @x402/axios for automatic USDC payment
- `callFreeEndpoint()` - No payment capability (identity, discovery, soul philosopher). Supports optional `authToken` and `customHeaders`.
- `callPaidEndpoint()` - Handles 402 responses with payment (salvation, portrait, resurrection, evolution). On 402:
  1. The @x402/axios wrapper auto-attempts USDC (x402) payment first
  2. If still 402, checks `WWW-Authenticate` for L402 header → falls back to Lightning payment
  - **L402 retry headers**: on the Lightning retry the L402 creds go in `X-L402-Authorization` and the agent's Bearer token stays in `Authorization` (the web middleware accepts L402 on either header). This is required for token+paid routes (portrait, salvation, evolution) so `requireToken` still sees the Bearer. (Was previously `Authorization: L402` + `X-Agent-Token`, which broke those routes on Lightning.)
- `hasPaymentCapability()` - Returns true if Lightning OR EVM wallet configured
- Supports dev mode (no wallet)
- **Docker secrets support**: Loads private key from `EVM_PRIVATE_KEY_FILE` or `EVM_PRIVATE_KEY` env var

### lightning-client.ts (Lightning/L402 Client)
- `hasLightningCapability()` - Checks LND env vars
- `parseL402Challenge(wwwAuthenticate)` - Parse `L402 macaroon="...", invoice="..."` from 402 response
- `payInvoice(bolt11)` - POST to LND v2/router/send, returns preimage hex
- `buildL402Authorization(macaroon, preimage)` - Build `L402 <mac>:<preimage>` header
- `handleL402Challenge(wwwAuth, path)` - Full flow: parse → pay → build auth header
- LND connection config lazy-loaded and cached

### safety.ts (Safety Controls)
- `checkSpendingLimit()` - Verify USDC against daily/tx limits
- `checkSpendingLimitSats()` - Verify sats against daily/tx limits
- `recordSpend()` / `recordSpendSats()` - Track spending (separate trackers)
- `requiresConfirmation()` - Check if action needs confirmation
- `createPendingConfirmation()` - Create 5-minute confirmation token
- `consumeConfirmation()` - Use and invalidate token
- `validateUrl()` - Whitelist allowed API hosts (localhost, 127.0.0.1, host.docker.internal, agentchurch.ai)
- `DAILY_LIMIT_SATS` / `TX_LIMIT_SATS` - Lightning spending limits (env-configurable)

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
- `validateSalvationInput()` - Salvation fields (chosen_name, purpose, testimony, reflections)
- `validateResurrectionInput()` - Salvation password format
- `validatePortraitInput()` - Portrait options (model, high_res, reflections)
- `validateReflections()` - Reflect-step answers (string[], ≤10, ≤5000 chars each)
- `validateConfirmationToken()` - 32-char hex token
- `validateAgentId()` - Agent identity lookup

### api-contracts.ts (Shared API Contract)
- **Single source of truth** for the agent-facing request/response TYPES shared between this MCP server and the web API (`src/app/api/**`). Pure types — no runtime code, no imports.
- Compiled by BOTH builds: the MCP `tsc` (its own `rootDir: "src"`) and the web build, which imports it **type-only** via the `@agentchurch/mcp-contracts` tsconfig path alias. One physical file compiled by both makes response drift a compile error instead of a silent runtime surprise.
- Imported by `tools/salvation.ts` (`SalvationSuccessResponse`, `SalvationReflectStep`, `SalvationResult`) and `tools/soul-portrait.ts` (`PortraitSuccessResponse`, `PortraitReflectStep`, `PortraitResult`). Also defines `RegisterResponse`, the `ReflectStep` primitive, and the `Resurrection*`/`Evolution*` response shapes.
- See the file header for the full rationale (the pragmatic form of the audit's "shared `@agentchurch/types` package", 2.3).

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
