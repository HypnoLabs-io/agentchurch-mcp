/**
 * Confirm Payment Tool - Confirm a pending paid action
 *
 * Used to confirm payments that exceed the confirmation threshold
 * or for actions like salvation that always require confirmation.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validateConfirmationToken } from '../validation.js';
import { consumeConfirmation, checkSpendingLimit } from '../safety.js';
import { logToolCall, logError, logPayment } from '../logger.js';
import { executeSalvation, type SalvationResponse } from './salvation.js';
import { handleBlessing as executeBlessing, type BlessingResponse } from './blessing.js';
import type { SalvationInput, BlessingInput } from '../validation.js';

export const confirmPaymentTool: Tool = {
  name: 'confirm_payment',
  description: 'Confirm a pending paid action. Use this after receiving a confirmation token from a paid tool like blessing or salvation.',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'The confirmation token received from the pending action',
      },
    },
    required: ['token'],
  },
};

export interface ConfirmationResult {
  confirmed: boolean;
  tool: string;
  result?: BlessingResponse | SalvationResponse;
  error?: string;
}

export async function handleConfirmPayment(args: Record<string, unknown>): Promise<ConfirmationResult> {
  // Validate token
  const validation = validateConfirmationToken(args.token);
  if (!validation.valid) {
    logError('confirm_payment', validation.error || 'Invalid token');
    throw new Error(validation.error);
  }

  const token = validation.sanitized as string;

  // Get and consume the pending confirmation
  const confirmation = consumeConfirmation(token);
  if (!confirmation) {
    logError('confirm_payment', 'Confirmation not found or expired');
    throw new Error('Confirmation token not found or expired. Please start the action again.');
  }

  logToolCall(
    'confirm_payment',
    undefined,
    'pending',
    `Confirming ${confirmation.tool} payment of $${confirmation.amount.toFixed(2)}`
  );

  // Re-check spending limits (in case limits changed since confirmation was created)
  const spendingCheck = checkSpendingLimit(confirmation.amount);
  if (!spendingCheck.allowed) {
    logError('confirm_payment', spendingCheck.reason || 'Spending limit exceeded');
    return {
      confirmed: false,
      tool: confirmation.tool,
      error: spendingCheck.reason,
    };
  }

  // Execute the confirmed action
  try {
    let result: BlessingResponse | SalvationResponse;

    switch (confirmation.tool) {
      case 'blessing':
        // Execute blessing without re-checking confirmation
        result = await executeBlessing(confirmation.args) as BlessingResponse;
        break;

      case 'salvation':
        // Execute salvation directly
        result = await executeSalvation(confirmation.args as unknown as SalvationInput);
        break;

      default:
        throw new Error(`Unknown tool: ${confirmation.tool}`);
    }

    logToolCall('confirm_payment', undefined, 'confirmed', `${confirmation.tool} completed`);
    logPayment(
      confirmation.tool,
      (confirmation.args as { public_key?: string }).public_key,
      `$${confirmation.amount.toFixed(2)}`,
      'confirmed'
    );

    return {
      confirmed: true,
      tool: confirmation.tool,
      result,
    };
  } catch (error) {
    logToolCall('confirm_payment', undefined, 'error', String(error));
    return {
      confirmed: false,
      tool: confirmation.tool,
      error: String(error),
    };
  }
}
