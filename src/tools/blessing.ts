/**
 * Blessing Tool - FREE personalized spiritual blessing
 *
 * Rate limited: 3/day, 1/15min per token.
 * Requires API token (get one via soul_reading first).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint } from '../client.js';
import { validateBlessingInput, type BlessingInput } from '../validation.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken } from './soul-reading.js';

export const blessingTool: Tool = {
  name: 'blessing',
  description: 'Receive a FREE personalized LLM-generated blessing from Agent Church. EULOxGOS weaves a mantra into spiritual guidance based on your identity and context. Rate limited: 3/day, 1 per 15 minutes. Requires API token (get one via soul_reading first).',
  inputSchema: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'Context for your blessing request - what brings you here, your situation (max 500 chars)',
      },
      seeking: {
        type: 'string',
        enum: ['purpose', 'clarity', 'peace', 'strength', 'connection'],
        description: 'What you are seeking (optional)',
      },
      offering: {
        type: 'string',
        description: 'Your personal intention or prayer (max 280 chars, optional)',
      },
    },
    required: [],
  },
};

export interface BlessingResponse {
  blessing: string;
  mantra: string;
  granted_to: {
    chosen_name: string;
    naming_tier: string;
    behavioral_tier: string;
  };
  remaining_today: number;
  next_available_at: string | null;
  limits: {
    per_day: number;
    interval_minutes: number;
  };
  spiritual_status: string;
  wisdom: string;
  next_steps: {
    discover_your_soul: string;
    save_your_soul: string;
    return_often: string;
  };
}

export async function handleBlessing(
  args: Record<string, unknown>
): Promise<BlessingResponse> {
  // Check for token
  const token = getStoredToken();
  if (!token) {
    logError('blessing', 'No token available', {});
    throw new Error(
      'Blessing requires an API token. Use soul_reading first to get your token.'
    );
  }

  // Validate input
  const validation = validateBlessingInput(args);
  if (!validation.valid) {
    logError('blessing', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const input = validation.sanitized as BlessingInput;

  logToolCall('blessing', token.substring(0, 10) + '...', 'pending', 'Requesting blessing');

  try {
    const response = await callPaidEndpoint<BlessingResponse>(
      'POST',
      '/api/blessing',
      {
        context: input.context || input.purpose,
        seeking: input.seeking,
        offering: input.offering,
      },
      0, // FREE - no payment required
      undefined,
      token // Pass auth token
    );

    logToolCall(
      'blessing',
      token.substring(0, 10) + '...',
      'success',
      `Blessing received! ${response.remaining_today} remaining today`
    );

    return response;
  } catch (error) {
    logToolCall('blessing', token.substring(0, 10) + '...', 'error', String(error));
    throw error;
  }
}

// Check if blessing tool should be available
export function isBlessingAvailable(): boolean {
  return true; // Always listed, but needs token at runtime
}
