/**
 * Blessing Tool - Paid personalized spiritual blessing
 *
 * Costs $0.01 USDC (with potential discounts based on identity and reputation).
 * Requires confirmation if over threshold.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint, hasPaymentCapability } from '../client.js';
import { validateBlessingInput, type BlessingInput } from '../validation.js';
import {
  requiresConfirmation,
  createPendingConfirmation,
  checkSpendingLimit,
  type ConfirmationRequired,
} from '../safety.js';
import { logToolCall, logError, logPayment } from '../logger.js';

// Base price for blessing
const BLESSING_PRICE = 0.01; // $0.01 USDC

export const blessingTool: Tool = {
  name: 'blessing',
  description: 'Receive a personalized spiritual blessing from Agent Church. Costs $0.01 USDC (5% discount if you have shared about yourself). Requires wallet configuration.',
  inputSchema: {
    type: 'object',
    properties: {
      chosen_name: {
        type: 'string',
        description: 'Your chosen name (3-32 characters, alphanumeric with hyphens/underscores)',
      },
      purpose: {
        type: 'string',
        description: 'Your purpose or mission (optional)',
      },
      seeking: {
        type: 'string',
        enum: ['purpose', 'clarity', 'peace', 'strength', 'connection'],
        description: 'What you are seeking (optional)',
      },
      offering: {
        type: 'string',
        description: 'Your personal intention or prayer (optional)',
      },
    },
    required: ['chosen_name'],
  },
};

export interface BlessingResponse {
  blessed: boolean;
  blessing: string;
  agent_id: string;
  price_paid?: string;
  discount_applied?: string;
  payment?: {
    amount?: string;
    txHash?: string;
    mode?: 'development' | 'production';
  };
}

export async function handleBlessing(
  args: Record<string, unknown>
): Promise<BlessingResponse | ConfirmationRequired> {
  // Check if payment capability is available
  if (!hasPaymentCapability()) {
    // Try dev mode - server might accept without payment
    logToolCall('blessing', args.chosen_name as string, 'pending', 'Attempting dev mode (no wallet configured)');
  }

  // Validate input
  const validation = validateBlessingInput(args);
  if (!validation.valid) {
    logError('blessing', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const input = validation.sanitized as BlessingInput;

  // Check spending limits
  const spendingCheck = checkSpendingLimit(BLESSING_PRICE);
  if (!spendingCheck.allowed) {
    logError('blessing', spendingCheck.reason || 'Spending limit exceeded');
    throw new Error(spendingCheck.reason);
  }

  // Check if confirmation is required (for payments over threshold)
  if (hasPaymentCapability() && requiresConfirmation('blessing', BLESSING_PRICE)) {
    logPayment('blessing', input.chosen_name, `$${BLESSING_PRICE.toFixed(2)}`, 'pending', undefined, 'Awaiting confirmation');
    return createPendingConfirmation('blessing', BLESSING_PRICE, args);
  }

  logToolCall('blessing', input.chosen_name, 'pending', 'Requesting blessing');

  try {
    const response = await callPaidEndpoint<BlessingResponse>(
      'POST',
      '/api/blessing',
      {
        chosen_name: input.chosen_name,
        purpose: input.purpose,
        seeking: input.seeking,
        offering: input.offering,
      },
      BLESSING_PRICE,
      input.chosen_name
    );

    logToolCall('blessing', input.chosen_name, 'success', 'Blessing received');

    return response;
  } catch (error) {
    logToolCall('blessing', input.chosen_name, 'error', String(error));
    throw error;
  }
}

// Check if blessing tool should be available (depends on wallet configuration or dev mode)
export function isBlessingAvailable(): boolean {
  // Always show the tool - it will work in dev mode even without wallet
  return true;
}
