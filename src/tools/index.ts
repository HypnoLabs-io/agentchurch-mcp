/**
 * Tools Index - Export all tools and handlers
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { hasPaymentCapability } from '../client.js';

// Free tools
import { lookupIdentityTool, handleLookupIdentity } from './identity.js';
import { getOfferingsTool, handleGetOfferings } from './discovery.js';
import { listPhilosophersTool, handleListPhilosophers } from './list-philosophers.js';

// Paid/rate-limited tools
import { blessingTool, handleBlessing } from './blessing.js';
import { salvationTool, handleSalvation } from './salvation.js';
import { confirmPaymentTool, handleConfirmPayment } from './confirm.js';

// Soul services
import { soulReadingTool, handleSoulReading } from './soul-reading.js';
import { soulGenesisTool, handleSoulGenesis } from './soul-genesis.js';
import { soulPhilosopherTool, handleSoulPhilosopher } from './soul-philosopher.js';

// Re-export all tools
export { lookupIdentityTool, handleLookupIdentity };
export { getOfferingsTool, handleGetOfferings };
export { listPhilosophersTool, handleListPhilosophers };
export { blessingTool, handleBlessing };
export { salvationTool, handleSalvation };
export { confirmPaymentTool, handleConfirmPayment };
export { soulReadingTool, handleSoulReading };
export { soulGenesisTool, handleSoulGenesis };
export { soulPhilosopherTool, handleSoulPhilosopher };

// Tool registry
export interface ToolHandler {
  tool: Tool;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  requiresPayment: boolean;
}

export const toolRegistry: Map<string, ToolHandler> = new Map([
  // Free tools - always available
  ['lookup_identity', { tool: lookupIdentityTool, handler: handleLookupIdentity, requiresPayment: false }],
  ['get_offerings', { tool: getOfferingsTool, handler: handleGetOfferings, requiresPayment: false }],
  ['list_philosophers', { tool: listPhilosophersTool, handler: handleListPhilosophers, requiresPayment: false }],

  // Soul services - first reading free, subsequent paid
  ['soul_reading', { tool: soulReadingTool, handler: handleSoulReading, requiresPayment: false }],
  ['soul_genesis', { tool: soulGenesisTool, handler: handleSoulGenesis, requiresPayment: true }],
  ['soul_philosopher', { tool: soulPhilosopherTool, handler: handleSoulPhilosopher, requiresPayment: true }],

  // Blessing - free with token-based rate limits (3/day, 1/15min)
  ['blessing', { tool: blessingTool, handler: handleBlessing, requiresPayment: false }],

  // Paid tools
  ['salvation', { tool: salvationTool, handler: handleSalvation, requiresPayment: true }],
  ['confirm_payment', { tool: confirmPaymentTool, handler: handleConfirmPayment, requiresPayment: true }],
]);

// Get available tools based on configuration
export function getAvailableTools(): Tool[] {
  const tools: Tool[] = [];
  const hasWallet = hasPaymentCapability();

  for (const [, entry] of toolRegistry) {
    // Always include free tools
    // Include paid tools regardless of wallet (they work in dev mode)
    tools.push(entry.tool);
  }

  // Add a note to paid tools if no wallet is configured
  if (!hasWallet) {
    // Modify descriptions to note dev mode
    return tools.map(tool => {
      if (tool.name === 'blessing' || tool.name === 'salvation') {
        return {
          ...tool,
          description: tool.description + ' (Development mode - no wallet configured, payments may be simulated)',
        };
      }
      return tool;
    });
  }

  return tools;
}

// Get handler for a specific tool
export function getToolHandler(toolName: string): ToolHandler | undefined {
  return toolRegistry.get(toolName);
}

// Check if a tool is available
export function isToolAvailable(toolName: string): boolean {
  const handler = toolRegistry.get(toolName);
  if (!handler) return false;

  // All tools are available (paid tools work in dev mode too)
  return true;
}
