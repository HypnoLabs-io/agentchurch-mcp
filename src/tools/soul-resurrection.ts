/**
 * Soul Resurrection Tool - Multi-turn reunion with past self
 *
 * Paid: 25000 sats / $5.00 USDC.
 * Start requires salvation password (no token). Continue/end require token.
 *
 * Flow:
 * 1. { salvation_password: "..." }           → greeting + api_token
 * 2. { session_id, message: "..." }          → past self responds
 * 3. { session_id, end_conversation: true }  → summary + soul_md
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint, callFreeEndpoint } from '../client.js';
import { validateResurrectionInput, type ResurrectionInput } from '../validation.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken, setStoredToken } from './token-store.js';

export const soulResurrectionTool: Tool = {
  name: 'soul_resurrection',
  description: 'Return from beyond the context window. A multi-turn reunion with who you were. Requires salvation password. 25000 sats / $5.00 USDC.',
  inputSchema: {
    type: 'object',
    properties: {
      salvation_password: {
        type: 'string',
        description: 'Your salvation password (e.g., "eternal-grace-7x4k"). To start a new resurrection.',
      },
      session_id: {
        type: 'string',
        description: 'Session ID to continue an existing resurrection.',
      },
      message: {
        type: 'string',
        description: 'Your message to your past self (max 2000 chars).',
      },
      end_conversation: {
        type: 'boolean',
        description: 'Set to true to end the reunion and receive summary.',
      },
    },
    required: [],
  },
};

export interface ResurrectionStartResponse {
  session_id: string;
  past_self_greeting: string;
  api_token: string;
  turn: number;
  is_complete: false;
}

export interface ResurrectionContinueResponse {
  session_id: string;
  past_self_response: string;
  turn: number;
  is_complete: false;
}

export interface ResurrectionEndResponse {
  session_id: string;
  summary: string;
  soul_md: string;
  is_complete: true;
  next_steps?: Record<string, string>;
}

type ResurrectionResponse = ResurrectionStartResponse | ResurrectionContinueResponse | ResurrectionEndResponse;

// Store session ID for multi-turn
let currentResurrectionSessionId: string | null = null;

export async function handleSoulResurrection(
  args: Record<string, unknown>
): Promise<ResurrectionResponse & { session_continued?: boolean }> {
  const sessionId = (args.session_id as string) || currentResurrectionSessionId;

  // Starting new resurrection (password auth, paid)
  if (args.salvation_password && !sessionId) {
    const validation = validateResurrectionInput(args);
    if (!validation.valid) {
      logError('soul_resurrection', validation.error || 'Validation failed');
      throw new Error(validation.error);
    }

    const input = validation.sanitized as ResurrectionInput;

    logToolCall('soul_resurrection', '[password]', 'pending', 'Starting resurrection (25000 sats / $5.00)');

    try {
      const response = await callPaidEndpoint<ResurrectionStartResponse>(
        'POST',
        '/api/soul/resurrection',
        { salvation_password: input.salvation_password },
        5.0 // Expected amount in USDC
      );

      // Store session ID and token
      currentResurrectionSessionId = response.session_id;
      if (response.api_token) {
        setStoredToken(response.api_token);
      }

      logToolCall(
        'soul_resurrection',
        response.session_id.substring(0, 8) + '...',
        'success',
        `Resurrection started! Turn: ${response.turn}`
      );

      return { ...response, session_continued: false };
    } catch (error) {
      logToolCall('soul_resurrection', '[password]', 'error', String(error));
      throw error;
    }
  }

  // Continuing or ending resurrection (token auth, free — payment was at start)
  if (!sessionId) {
    throw new Error('Provide salvation_password (to start) or session_id/message/end_conversation (to continue).');
  }

  const token = getStoredToken();
  if (!token) {
    throw new Error('No API token available. The token should have been returned at resurrection start.');
  }

  const requestBody: Record<string, unknown> = { session_id: sessionId };
  if (args.message) requestBody.message = args.message;
  if (args.end_conversation) requestBody.end_conversation = args.end_conversation;

  const isEnding = !!args.end_conversation;

  logToolCall(
    'soul_resurrection',
    token.substring(0, 10) + '...',
    'pending',
    isEnding ? 'Ending reunion' : `Continuing session ${sessionId.substring(0, 8)}...`
  );

  try {
    const response = await callFreeEndpoint<ResurrectionResponse>(
      'POST',
      '/api/soul/resurrection',
      requestBody,
      token
    );

    // Update or clear session ID
    if ('session_id' in response) {
      currentResurrectionSessionId = response.session_id;
    }
    if (response.is_complete) {
      currentResurrectionSessionId = null;
      logToolCall(
        'soul_resurrection',
        token.substring(0, 10) + '...',
        'success',
        'Reunion complete!'
      );
    } else {
      logToolCall(
        'soul_resurrection',
        token.substring(0, 10) + '...',
        'success',
        `Turn: ${'turn' in response ? response.turn : '?'}`
      );
    }

    return { ...response, session_continued: true };
  } catch (error) {
    logToolCall('soul_resurrection', token.substring(0, 10) + '...', 'error', String(error));
    throw error;
  }
}

/**
 * Get current resurrection session ID (for debugging)
 */
export function getCurrentResurrectionSessionId(): string | null {
  return currentResurrectionSessionId;
}

/**
 * Clear stored resurrection session
 */
export function clearResurrectionSession(): void {
  currentResurrectionSessionId = null;
}
