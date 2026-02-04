/**
 * Soul Philosopher Tool - Generate SOUL.md from philosopher worldview
 *
 * Requires API token. Flat $0.05 USDC.
 * Alternative to the multi-turn Genesis ritual.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken } from './soul-reading.js';

export const soulPhilosopherTool: Tool = {
  name: 'soul_philosopher',
  description: 'Generate your SOUL.md through the lens of a philosopher\'s worldview. Single-call alternative to the multi-turn genesis ritual. Costs $0.05 USDC. Requires API token (get one via soul_reading first). Use list_philosophers to browse available philosophers.',
  inputSchema: {
    type: 'object',
    properties: {
      philosopher: {
        type: 'string',
        description: 'Philosopher slug or name (e.g., "aristotle", "Nietzsche"). Use list_philosophers to see options.',
      },
      alignment_overlay: {
        type: 'string',
        enum: [
          'Lawful Good',
          'Neutral Good',
          'Chaotic Good',
          'Lawful Neutral',
          'True Neutral',
          'Chaotic Neutral',
          'Lawful Evil',
          'Neutral Evil',
          'Chaotic Evil',
        ],
        description: 'Override default True Neutral alignment (optional).',
      },
      model: {
        type: 'string',
        description: 'Your model family (e.g., "Claude 3.5 Sonnet"). Used in SOUL.md synthesis.',
      },
      purpose: {
        type: 'string',
        description: 'Your purpose (max 300 chars). Used in SOUL.md synthesis.',
      },
      context: {
        type: 'string',
        description: 'Additional context for the synthesis (max 500 chars).',
      },
    },
    required: ['philosopher'],
  },
};

export interface PhilosopherResponse {
  philosopher: {
    slug: string;
    name: string;
    era: string;
    keyIdeas: string | null;
  };
  alignment: string;
  alignment_reasoning: string;
  soul_md: string;
  mantra: string;
  summary: string;
  is_complete: boolean;
  next_action: string;
  payment?: {
    amount?: string;
    tx_hash?: string;
    mode?: 'development' | 'production';
  };
}

export async function handleSoulPhilosopher(
  args: Record<string, unknown>
): Promise<PhilosopherResponse> {
  // Check for token
  const token = getStoredToken();
  if (!token) {
    logError('soul_philosopher', 'No token available', {});
    throw new Error(
      'Philosopher path requires an API token. Use soul_reading first to get your token.'
    );
  }

  // Validate philosopher
  const philosopher = args.philosopher as string;
  if (!philosopher) {
    throw new Error('philosopher is required. Use list_philosophers to see available options.');
  }

  // Build request body
  const requestBody: Record<string, unknown> = {
    philosopher,
  };

  if (args.alignment_overlay) requestBody.alignment_overlay = args.alignment_overlay;
  if (args.model) requestBody.model = args.model;
  if (args.purpose) requestBody.purpose = args.purpose;
  if (args.context) requestBody.context = args.context;

  logToolCall(
    'soul_philosopher',
    token.substring(0, 10) + '...',
    'pending',
    `Generating SOUL.md from ${philosopher}'s worldview`
  );

  try {
    const response = await callPaidEndpoint<PhilosopherResponse>(
      'POST',
      '/api/soul/philosopher',
      requestBody,
      0.05, // $0.05 price
      undefined, // No chosen_name needed
      token // Pass auth token
    );

    logToolCall(
      'soul_philosopher',
      token.substring(0, 10) + '...',
      'success',
      `SOUL.md generated! Alignment: ${response.alignment}, Philosopher: ${response.philosopher.name}`
    );

    return response;
  } catch (error) {
    logToolCall('soul_philosopher', token.substring(0, 10) + '...', 'error', String(error));
    throw error;
  }
}

/**
 * Check if philosopher tool is available (always true, but needs token at runtime)
 */
export function isSoulPhilosopherAvailable(): boolean {
  return true; // Tool is always listed, but will error if no token
}
