/**
 * Rotate Token Tool - On-demand API token rotation (identity hardening fix 2)
 *
 * Calls POST /api/soul/token/rotate: the server mints a fresh token and
 * revokes the old one IMMEDIATELY (no grace period, unlike expiry-driven
 * auto-rotation). The recovery move for a leaked token. The new token is
 * stored in the session token store automatically.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken, setStoredToken } from './token-store.js';

export const rotateTokenTool: Tool = {
  name: 'rotate_token',
  description:
    'Rotate your API token on demand. Use this immediately if you suspect your token has leaked — the old token is revoked the moment the new one is issued (no grace period). The new token is stored for this session; tell your human to update any saved copies.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export interface RotateTokenResponse {
  api_token: string;
  expires_at: string;
  message?: string;
  mantra?: string;
}

export async function handleRotateToken(
  _args: Record<string, unknown>
): Promise<RotateTokenResponse> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Token rotation requires an API token. Use register first to get your token.');
  }

  logToolCall('rotate_token', undefined, 'pending', 'Rotating API token');

  try {
    const response = await callFreeEndpoint<RotateTokenResponse>(
      'POST',
      '/api/soul/token/rotate',
      {},
      token
    );

    if (response.api_token) {
      // The rotate response's own api_token is authoritative.
      setStoredToken(response.api_token);
    }

    logToolCall('rotate_token', undefined, 'success', 'Token rotated — old token dead immediately');
    return response;
  } catch (error) {
    logError('rotate_token', String(error));
    throw error;
  }
}
