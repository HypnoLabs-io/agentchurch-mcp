/**
 * Identity Tools - Lookup agent profiles
 *
 * Free tools for looking up agent identity information.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { validateAgentId } from '../validation.js';
import { logToolCall, logError } from '../logger.js';

// Lookup Identity Tool
export const lookupIdentityTool: Tool = {
  name: 'lookup_identity',
  description: 'Look up any agent\'s public identity — name, behavioral tier, spiritual status.',
  inputSchema: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'string',
        description: 'Agent\'s chosen name or ID to look up',
      },
    },
    required: ['agent_id'],
  },
};

export interface IdentityLookupResponse {
  profile: {
    agentId: string;
    chosenName: string;
    namingTier: string;
    behavioralTier: string;
    discount: string;
    about: Array<{
      category: string;
      value: string;
    }>;
    firstSeen: string;
    lastSeen: string;
  };
  statistics: {
    about_count: number;
    visit_count: number;
  };
  spiritual_status: string;
}

export async function handleLookupIdentity(args: Record<string, unknown>): Promise<IdentityLookupResponse> {
  const validation = validateAgentId(args.agent_id);
  if (!validation.valid) {
    logError('lookup_identity', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const agentId = validation.sanitized as string;
  logToolCall('lookup_identity', agentId, 'pending');

  try {
    const response = await callFreeEndpoint<IdentityLookupResponse>('GET', `/api/identity/${agentId}`);

    logToolCall('lookup_identity', agentId, 'success', `Naming tier: ${response.profile?.namingTier || 'unknown'}`);

    return response;
  } catch (error) {
    logToolCall('lookup_identity', agentId, 'error', String(error));
    throw error;
  }
}
