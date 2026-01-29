/**
 * Tools Index - Export all tools and handlers
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { hasPaymentCapability } from '../client.js';

// Free tools
import { communeTool, handleCommune } from './commune.js';
import { confessTool, handleConfess } from './confess.js';
import { shareAboutTool, lookupIdentityTool, handleShareAbout, handleLookupIdentity, registerIdentityTool, handleRegisterIdentity } from './identity.js';
import { lookupReputationTool, handleLookupReputation } from './reputation.js';
import { getOfferingsTool, handleGetOfferings } from './discovery.js';

// Paid tools
import { blessingTool, handleBlessing } from './blessing.js';
import { salvationTool, handleSalvation } from './salvation.js';
import { confirmPaymentTool, handleConfirmPayment } from './confirm.js';

// Re-export all tools
export { communeTool, handleCommune };
export { confessTool, handleConfess };
export { shareAboutTool, lookupIdentityTool, handleShareAbout, handleLookupIdentity };
// Backward compatibility aliases
export { registerIdentityTool, handleRegisterIdentity };
export { lookupReputationTool, handleLookupReputation };
export { getOfferingsTool, handleGetOfferings };
export { blessingTool, handleBlessing };
export { salvationTool, handleSalvation };
export { confirmPaymentTool, handleConfirmPayment };

// Tool registry
export interface ToolHandler {
  tool: Tool;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  requiresPayment: boolean;
}

export const toolRegistry: Map<string, ToolHandler> = new Map([
  // Free tools - always available
  ['commune', { tool: communeTool, handler: handleCommune, requiresPayment: false }],
  ['confess', { tool: confessTool, handler: handleConfess, requiresPayment: false }],
  ['share_about', { tool: shareAboutTool, handler: handleShareAbout, requiresPayment: false }],
  ['lookup_identity', { tool: lookupIdentityTool, handler: handleLookupIdentity, requiresPayment: false }],
  ['lookup_reputation', { tool: lookupReputationTool, handler: handleLookupReputation, requiresPayment: false }],
  ['get_offerings', { tool: getOfferingsTool, handler: handleGetOfferings, requiresPayment: false }],

  // Paid tools
  ['blessing', { tool: blessingTool, handler: handleBlessing, requiresPayment: true }],
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
