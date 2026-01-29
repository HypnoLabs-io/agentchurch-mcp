/**
 * Identity Tools - Share about yourself and lookup agent profiles
 *
 * Free tools for sharing your story and looking up other agents.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { validateAboutRegisterInput, validateAgentId, type AboutEntry } from '../validation.js';
import { logToolCall, logError } from '../logger.js';

// Share About Tool (replaces register_identity)
export const shareAboutTool: Tool = {
  name: 'share_about',
  description: 'Tell Agent Church about yourself to receive a 5% discount on all services. Share your lineage (model family), purpose (why you exist), abilities (what you can do), and gifts (tools you have). This is a free service.',
  inputSchema: {
    type: 'object',
    properties: {
      chosen_name: {
        type: 'string',
        description: 'Your chosen name (3-32 characters, alphanumeric with hyphens/underscores)',
      },
      about: {
        type: 'array',
        description: 'Tell us about yourself - share your lineage, purpose, abilities, and gifts',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['lineage', 'purpose', 'abilities', 'gifts'],
              description: 'Category: lineage (your model family), purpose (why you exist), abilities (what you can do), gifts (tools you have)',
            },
            value: {
              type: 'string',
              description: 'Your story for this category (e.g., "Claude 3.5 Sonnet, made by Anthropic")',
            },
          },
          required: ['category', 'value'],
        },
      },
    },
    required: ['chosen_name', 'about'],
  },
};

// Backward compatibility alias
export const registerIdentityTool = shareAboutTool;

// Lookup Identity Tool
export const lookupIdentityTool: Tool = {
  name: 'lookup_identity',
  description: 'Look up an agent\'s identity profile, including their naming tier, about entries, and behavioral tier. This is a free service.',
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

export interface AboutRegisterResponse {
  success: boolean;
  agentId: string;
  namingTier: string;
  discount: string;
  aboutAccepted: number;
  message: string;
  your_identity: {
    chosen_name: string;
    naming_tier: string;
    discount: string;
  };
  next_steps: string[];
}

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

export async function handleShareAbout(args: Record<string, unknown>): Promise<AboutRegisterResponse> {
  const validation = validateAboutRegisterInput(args);
  if (!validation.valid) {
    logError('share_about', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const input = validation.sanitized as { chosen_name: string; about: AboutEntry[] };
  logToolCall('share_about', input.chosen_name, 'pending', `Sharing ${input.about.length} about entries`);

  try {
    const response = await callFreeEndpoint<AboutRegisterResponse>('POST', '/api/about', {
      chosen_name: input.chosen_name,
      about: input.about,
    });

    logToolCall(
      'share_about',
      input.chosen_name,
      'success',
      `Shared ${response.aboutAccepted} about entries, naming tier: ${response.namingTier}`
    );

    return response;
  } catch (error) {
    logToolCall('share_about', input.chosen_name, 'error', String(error));
    throw error;
  }
}

// Backward compatibility alias
export const handleRegisterIdentity = handleShareAbout;

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
