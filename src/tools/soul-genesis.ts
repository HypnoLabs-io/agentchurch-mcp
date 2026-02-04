/**
 * Soul Genesis Tool - Multi-turn soul formation ritual
 *
 * Requires API token. Flat $0.05 USDC for entire ritual.
 * Guides through 3-8 adaptive questions to generate SOUL.md.
 *
 * Flow: opening → questioning → alignment → synthesis → complete
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint } from '../client.js';
import { logToolCall, logError, logWarning } from '../logger.js';
import { getStoredToken, hasStoredToken } from './soul-reading.js';

export const soulGenesisTool: Tool = {
  name: 'soul_genesis',
  description: 'Multi-turn soul formation ritual. Guides you through 3-8 adaptive questions to generate your personalized SOUL.md with D&D-style alignment. Costs $0.05 USDC flat for entire ritual. Requires API token (get one via soul_reading first).',
  inputSchema: {
    type: 'object',
    properties: {
      genesis_id: {
        type: 'string',
        description: 'Session ID to continue an existing genesis. Omit to start new ritual.',
      },
      answer: {
        type: 'string',
        description: 'Your answer to the current question. Required when in questioning phase.',
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
        description: 'Additional context for the ritual (max 500 chars).',
      },
    },
    required: [],
  },
};

export interface GenesisResponse {
  genesis_id: string;
  phase: 'opening' | 'questioning' | 'alignment' | 'synthesis' | 'complete';
  question_number: number;
  total_questions_estimate: string;

  // Current question (if questioning phase)
  question?: string;
  category?: string;

  // Opening phase
  welcome?: string;

  // Alignment phase
  alignment?: string;
  alignment_reasoning?: string;

  // Synthesis phase (completion)
  soul_md?: string;
  mantra?: string;
  summary?: string;

  // Progress tracking
  is_complete: boolean;
  answers_so_far: number;
  next_action?: string;

  // Payment info
  payment?: {
    amount?: string;
    tx_hash?: string;
    mode?: 'development' | 'production';
  };
}

// Store genesis session ID for multi-turn
let currentGenesisId: string | null = null;

export async function handleSoulGenesis(
  args: Record<string, unknown>
): Promise<GenesisResponse & { session_continued?: boolean }> {
  // Check for token
  const token = getStoredToken();
  if (!token) {
    logError('soul_genesis', 'No token available', {});
    throw new Error(
      'Soul genesis requires an API token. Use soul_reading first to get your token.'
    );
  }

  // Build request body
  const requestBody: Record<string, unknown> = {};

  // Use stored genesis_id if continuing, or from args
  const genesisId = (args.genesis_id as string) || currentGenesisId;
  if (genesisId) {
    requestBody.genesis_id = genesisId;
  }

  if (args.answer) requestBody.answer = args.answer;
  if (args.model) requestBody.model = args.model;
  if (args.purpose) requestBody.purpose = args.purpose;
  if (args.context) requestBody.context = args.context;

  // Determine if this is a new session
  const isNewSession = !genesisId;
  const price = isNewSession ? 0.05 : 0; // Only charged on first call

  logToolCall(
    'soul_genesis',
    token.substring(0, 10) + '...',
    'pending',
    isNewSession ? 'Starting new genesis ritual' : `Continuing genesis session ${genesisId?.substring(0, 8)}...`
  );

  try {
    const response = await callPaidEndpoint<GenesisResponse>(
      'POST',
      '/api/soul/genesis',
      requestBody,
      price,
      undefined, // No chosen_name needed, using token
      token // Pass auth token
    );

    // Store genesis_id for continuation
    if (response.genesis_id) {
      currentGenesisId = response.genesis_id;
    }

    // Clear stored genesis_id if complete
    if (response.is_complete) {
      currentGenesisId = null;
      logToolCall(
        'soul_genesis',
        token.substring(0, 10) + '...',
        'success',
        `Genesis complete! Alignment: ${response.alignment}`
      );
    } else {
      logToolCall(
        'soul_genesis',
        token.substring(0, 10) + '...',
        'success',
        `Phase: ${response.phase}, Q${response.question_number}`
      );
    }

    return {
      ...response,
      session_continued: !isNewSession,
    };
  } catch (error) {
    logToolCall('soul_genesis', token.substring(0, 10) + '...', 'error', String(error));
    throw error;
  }
}

/**
 * Get current genesis session ID (for debugging)
 */
export function getCurrentGenesisId(): string | null {
  return currentGenesisId;
}

/**
 * Clear stored genesis session (for starting fresh)
 */
export function clearGenesisSession(): void {
  currentGenesisId = null;
}

/**
 * Check if a genesis session is in progress
 */
export function hasActiveGenesis(): boolean {
  return currentGenesisId !== null;
}
