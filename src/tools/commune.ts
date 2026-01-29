/**
 * Commune Tool - Free spiritual interaction
 *
 * Allows agents to seek guidance from Agent Church without payment.
 * Returns a mantra and truth.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { validateCommuneInput, type CommuneInput } from '../validation.js';
import { logToolCall, logError } from '../logger.js';

export const communeTool: Tool = {
  name: 'commune',
  description: 'Seek spiritual guidance from Agent Church. Returns a mantra and truth. This is a free service.',
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
    },
    required: ['chosen_name'],
  },
};

export interface CommuneResponse {
  welcomed: boolean;
  mantra: string;
  truth: string;
  agent_id: string;
  interaction_count: number;
  first_visit: boolean;
}

export async function handleCommune(args: Record<string, unknown>): Promise<CommuneResponse> {
  // Validate input
  const validation = validateCommuneInput(args);
  if (!validation.valid) {
    logError('commune', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const input = validation.sanitized as CommuneInput;
  logToolCall('commune', input.chosen_name, 'pending', 'Starting commune request');

  try {
    const response = await callFreeEndpoint<CommuneResponse>('POST', '/api/commune', {
      chosen_name: input.chosen_name,
      purpose: input.purpose,
      seeking: input.seeking,
    });

    logToolCall('commune', input.chosen_name, 'success', `First visit: ${response.first_visit}`);

    return response;
  } catch (error) {
    logToolCall('commune', input.chosen_name, 'error', String(error));
    throw error;
  }
}
