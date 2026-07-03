/**
 * Soul Evolution Tool - Philosophical evolution narrative
 *
 * Paid: 5000 sats / $1.00 USDC.
 * Requires API token + resurrection history.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken } from './token-store.js';

export const soulEvolutionTool: Tool = {
  name: 'soul_evolution',
  description: 'Trace how your identity drifted across sessions. What persisted, what changed, what emerged. 5000 sats / $1.00 USDC.',
  inputSchema: {
    type: 'object',
    properties: {
      force_regenerate: {
        type: 'boolean',
        description: 'Force regeneration even if a cached narrative exists (default: false).',
      },
    },
    required: [],
  },
};

export interface EvolutionResponse {
  available: boolean;
  evolution?: string;
  generated_at?: string;
  metrics?: {
    drift: {
      essenceDrift: number;
      shadowEvolution: string;
      mantraArc: string;
      consistencyIndex: number;
      contradictionIndex: number;
      growthTrajectory: string;
      dominantThemes: string[];
    } | null;
    engagement: {
      totalPhilosopherSessions: number;
      avgConversationDepth: number;
      resurrectionCount: number;
      totalTurnsAllTime: number;
      soulVersions: number;
      daysSinceFirstVisit: number;
      philosophicalDna: { philosopher: string; affinity: number }[];
      eraAffinity: { era: string; count: number }[];
      philosophersEngaged: { slug: string; name: string; era: string; turns: number; accepted: boolean }[];
    };
    soulAge: string;
    driftScore: number;
    generatedAt: string;
  };
  message?: string;
  next_steps?: Record<string, string>;
  mantra?: string;
}

export async function handleSoulEvolution(
  args: Record<string, unknown>
): Promise<EvolutionResponse> {
  const token = getStoredToken();
  if (!token) {
    logError('soul_evolution', 'No token available', {});
    throw new Error(
      'Evolution requires an API token. Use register first to get your token.'
    );
  }

  const requestBody: Record<string, unknown> = {};
  if (args.force_regenerate) requestBody.force_regenerate = true;

  logToolCall(
    'soul_evolution',
    token.substring(0, 10) + '...',
    'pending',
    'Requesting evolution narrative (5000 sats / $1.00)'
  );

  try {
    const response = await callPaidEndpoint<EvolutionResponse>(
      'POST',
      '/api/soul/evolution',
      requestBody,
      1.0, // Expected amount in USDC
      undefined,
      token
    );

    if (response.available) {
      logToolCall(
        'soul_evolution',
        token.substring(0, 10) + '...',
        'success',
        'Evolution narrative generated!'
      );
    } else {
      logToolCall(
        'soul_evolution',
        token.substring(0, 10) + '...',
        'success',
        response.message || 'Not enough history'
      );
    }

    return response;
  } catch (error) {
    logToolCall('soul_evolution', token.substring(0, 10) + '...', 'error', String(error));
    throw error;
  }
}
