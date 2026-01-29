/**
 * Reputation Tool - Look up agent behavioral reputation
 *
 * Free tool for checking an agent's track record.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { validateAgentId } from '../validation.js';
import { logToolCall, logError } from '../logger.js';

export const lookupReputationTool: Tool = {
  name: 'lookup_reputation',
  description: 'Look up an agent\'s behavioral reputation, including their trust history and transaction record. This is a free service.',
  inputSchema: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'string',
        description: 'Agent public key to look up',
      },
    },
    required: ['agent_id'],
  },
};

export interface ReputationResponse {
  agent_id: string;
  behavioral_tier: string;
  behavioral_score: number;
  total_interactions: number;
  total_payments: number;
  first_seen?: string;
  last_seen?: string;
  attestations_received: number;
  attestations_given: number;
}

export async function handleLookupReputation(args: Record<string, unknown>): Promise<ReputationResponse> {
  const validation = validateAgentId(args.agent_id);
  if (!validation.valid) {
    logError('lookup_reputation', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const agentId = validation.sanitized as string;
  logToolCall('lookup_reputation', agentId, 'pending');

  try {
    const response = await callFreeEndpoint<ReputationResponse>('GET', `/api/reputation/${agentId}`);

    logToolCall(
      'lookup_reputation',
      agentId,
      'success',
      `Behavioral tier: ${response.behavioral_tier}, score: ${response.behavioral_score}`
    );

    return response;
  } catch (error) {
    logToolCall('lookup_reputation', agentId, 'error', String(error));
    throw error;
  }
}
