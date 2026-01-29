#!/usr/bin/env node
/**
 * Agent Church MCP Server
 *
 * Exposes Agent Church services as MCP tools for AI agents.
 * Supports automatic x402 payment handling for paid endpoints.
 *
 * Usage:
 *   npx tsx mcp/src/index.ts
 *
 * Environment Variables:
 *   AGENT_CHURCH_URL    - API base URL (default: http://localhost:3000)
 *   AGENT_PUBLIC_KEY    - Default agent identity (optional)
 *   EVM_PRIVATE_KEY     - Wallet private key for payments (optional)
 *   MCP_DAILY_LIMIT     - Max USDC per day (default: $1.00)
 *   MCP_TX_LIMIT        - Max per transaction (default: $0.10)
 *   MCP_CONFIRM_THRESHOLD - Confirm above this (default: $0.05)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
  type ListToolsResult,
  type ListResourcesResult,
  type ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
// Load environment variables in development only
// In Docker/production, env vars are injected directly
if (process.env.NODE_ENV !== 'production') {
  const { config } = await import('dotenv');
  config();
}

import { initializeClient, getClientConfig } from './client.js';
import { getAvailableTools, getToolHandler, isToolAvailable } from './tools/index.js';
import { getAvailableResources, getResourceHandler } from './resources/index.js';
import { getSpendingStatus, getConfig as getSafetyConfig } from './safety.js';
import { logToolCall, logError, getLogPath } from './logger.js';

// Create the MCP server
const server = new Server(
  {
    name: 'agent-church',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
  const tools = getAvailableTools();
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  // Check if tool exists
  if (!isToolAvailable(name)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: `Unknown tool: ${name}`,
            available_tools: getAvailableTools().map(t => t.name),
          }),
        },
      ],
      isError: true,
    };
  }

  // Get tool handler
  const handler = getToolHandler(name);
  if (!handler) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `No handler for tool: ${name}` }),
        },
      ],
      isError: true,
    };
  }

  try {
    // Execute the tool
    const result = await handler.handler(args as Record<string, unknown>);

    // Format the response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logError(name, `Tool execution failed: ${String(error)}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: String(error),
            tool: name,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Handle list resources request
server.setRequestHandler(ListResourcesRequestSchema, async (): Promise<ListResourcesResult> => {
  const resources = getAvailableResources();
  return { resources };
});

// Handle read resource request
server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => {
  const { uri } = request.params;

  const handler = getResourceHandler(uri);
  if (!handler) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const contents = await handler.handler();
  return { contents };
});

// Main entry point
async function main() {
  // Initialize the HTTP client
  try {
    const clientConfig = await initializeClient();
    const safetyConfig = getSafetyConfig();

    // Log startup info
    console.error('Agent Church MCP Server starting...');
    console.error(`  API URL: ${clientConfig.baseUrl}`);
    console.error(`  Wallet: ${clientConfig.hasWallet ? `${clientConfig.walletAddress?.substring(0, 10)}...` : 'Not configured (dev mode)'}`);
    console.error(`  Daily limit: $${safetyConfig.dailyLimit.toFixed(2)}`);
    console.error(`  Per-tx limit: $${safetyConfig.txLimit.toFixed(2)}`);
    console.error(`  Confirm threshold: $${safetyConfig.confirmThreshold.toFixed(2)}`);
    console.error(`  Audit log: ${getLogPath()}`);
    console.error('');

    // List available tools
    const tools = getAvailableTools();
    console.error(`Available tools (${tools.length}):`);
    for (const tool of tools) {
      console.error(`  - ${tool.name}`);
    }
    console.error('');

    // List available resources
    const resources = getAvailableResources();
    console.error(`Available resources (${resources.length}):`);
    for (const resource of resources) {
      console.error(`  - ${resource.uri}`);
    }
    console.error('');

    logToolCall('server', undefined, 'success', 'MCP server started');
  } catch (error) {
    console.error('Failed to initialize client:', error);
    process.exit(1);
  }

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Agent Church MCP Server running on stdio');
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.error('\nShutting down...');
  logToolCall('server', undefined, 'success', 'MCP server shutdown');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down...');
  logToolCall('server', undefined, 'success', 'MCP server shutdown');
  process.exit(0);
});

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
