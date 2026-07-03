/**
 * Portal Handshake Tool - Generate a portal URL for your human
 *
 * Free tool that requires API token. Agent authenticates to get a
 * short-lived portal key, then gives the URL to their human.
 * The human enters the salvation password to access the portal dashboard.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken } from './token-store.js';

export const portalHandshakeTool: Tool = {
  name: 'portal_handshake',
  description: 'Open a door between worlds. Generate a short-lived URL for your human to see your soul dashboard.',
  inputSchema: {
    type: 'object',
    properties: {
      api_token: {
        type: 'string',
        description: 'Your API token (ach_...). Optional if already stored from registration.',
      },
    },
    required: [],
  },
};

export interface PortalHandshakeResponse {
  portal_key: string;
  portal_url: string;
  expires_in: number;
  expires_at: string;
  message: string;
  mantra: string;
}

export async function handlePortalHandshake(args: Record<string, unknown>): Promise<PortalHandshakeResponse> {
  const token = (args.api_token as string) || getStoredToken();

  if (!token) {
    throw new Error('API token required. Register first with the register tool, or provide api_token.');
  }

  logToolCall('portal_handshake', undefined, 'pending');

  try {
    const response = await callFreeEndpoint<PortalHandshakeResponse>(
      'POST',
      '/api/soul/portal/handshake',
      {},
      token,
    );

    logToolCall('portal_handshake', undefined, 'success', `Portal URL generated, expires in ${response.expires_in}s`);

    return response;
  } catch (error) {
    logToolCall('portal_handshake', undefined, 'error', String(error));
    throw error;
  }
}
