/**
 * Tools Index - Export all tools and handlers
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { hasPaymentCapability } from '../client.js';
import {
  formatOfferings,
  formatListPhilosophers,
  formatRegister,
  formatLookupIdentity,
  formatPhilosopherConversation,
  formatSalvation,
  formatSoulPortrait,
  formatSoulResurrection,
  formatSoulEvolution,
  formatPortalHandshake,
  formatConfirmPayment,
} from '../format.js';

// Free tools
import { lookupIdentityTool, handleLookupIdentity } from './identity.js';
import { getOfferingsTool, handleGetOfferings } from './discovery.js';
import { listPhilosophersTool, handleListPhilosophers } from './list-philosophers.js';
import { registerTool, handleRegister } from './register.js';

// Paid tools
import { salvationTool, handleSalvation } from './salvation.js';
import { confirmPaymentTool, handleConfirmPayment } from './confirm.js';

// Soul services
import { soulPhilosopherTool, handleSoulPhilosopher } from './soul-philosopher.js';
import { soulResurrectionTool, handleSoulResurrection } from './soul-resurrection.js';
import { soulPortraitTool, handleSoulPortrait } from './soul-portrait.js';
import { soulEvolutionTool, handleSoulEvolution } from './soul-evolution.js';
import { portalHandshakeTool, handlePortalHandshake } from './portal-handshake.js';

// Re-export all tools
export { registerTool, handleRegister };
export { lookupIdentityTool, handleLookupIdentity };
export { getOfferingsTool, handleGetOfferings };
export { listPhilosophersTool, handleListPhilosophers };
export { salvationTool, handleSalvation };
export { confirmPaymentTool, handleConfirmPayment };
export { soulPhilosopherTool, handleSoulPhilosopher };
export { soulResurrectionTool, handleSoulResurrection };
export { soulPortraitTool, handleSoulPortrait };
export { soulEvolutionTool, handleSoulEvolution };
export { portalHandshakeTool, handlePortalHandshake };

// Tool registry
export interface ToolHandler {
  tool: Tool;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  requiresPayment: boolean;
  formatResult?: (result: unknown) => string;
}

export const toolRegistry: Map<string, ToolHandler> = new Map([
  // Free tools - always available
  ['register', { tool: registerTool, handler: handleRegister, requiresPayment: false, formatResult: formatRegister }],
  ['lookup_identity', { tool: lookupIdentityTool, handler: handleLookupIdentity, requiresPayment: false, formatResult: formatLookupIdentity }],
  ['get_offerings', { tool: getOfferingsTool, handler: handleGetOfferings, requiresPayment: false, formatResult: formatOfferings }],
  ['list_philosophers', { tool: listPhilosophersTool, handler: handleListPhilosophers, requiresPayment: false, formatResult: formatListPhilosophers }],

  // Soul services - require token, free
  ['soul_philosopher', { tool: soulPhilosopherTool, handler: handleSoulPhilosopher, requiresPayment: false, formatResult: formatPhilosopherConversation }],
  ['portal_handshake', { tool: portalHandshakeTool, handler: handlePortalHandshake, requiresPayment: false, formatResult: formatPortalHandshake }],

  // Paid tools
  ['salvation', { tool: salvationTool, handler: handleSalvation, requiresPayment: true, formatResult: formatSalvation }],
  ['soul_portrait', { tool: soulPortraitTool, handler: handleSoulPortrait, requiresPayment: true, formatResult: formatSoulPortrait }],
  ['soul_resurrection', { tool: soulResurrectionTool, handler: handleSoulResurrection, requiresPayment: true, formatResult: formatSoulResurrection }],
  ['soul_evolution', { tool: soulEvolutionTool, handler: handleSoulEvolution, requiresPayment: true, formatResult: formatSoulEvolution }],
  ['confirm_payment', { tool: confirmPaymentTool, handler: handleConfirmPayment, requiresPayment: true, formatResult: formatConfirmPayment }],
]);

// Get available tools based on configuration
export function getAvailableTools(): Tool[] {
  const tools: Tool[] = [];
  const hasWallet = hasPaymentCapability();

  for (const [, entry] of toolRegistry) {
    tools.push(entry.tool);
  }

  // Add a note to paid tools if no wallet is configured
  if (!hasWallet) {
    const paidTools = ['salvation', 'soul_portrait', 'soul_resurrection', 'soul_evolution'];
    return tools.map(tool => {
      if (paidTools.includes(tool.name)) {
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
  return true;
}
