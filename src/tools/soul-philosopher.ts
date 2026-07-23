/**
 * Soul Philosopher Tool - Multi-turn conversation with a philosopher
 *
 * Requires API token. FREE.
 * Multi-turn flow using session_id.
 *
 * Flow:
 * 1. { philosopher: "camus" }           → store session_id, get opening
 * 2. { session_id, message: "..." }     → continue conversation
 * 3. { session_id, end_conversation: true } → get SOUL.md offer
 * 4. { session_id, accept: true }       → finalize
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';
import { getStoredToken } from './token-store.js';

export const soulPhilosopherTool: Tool = {
  name: 'soul_philosopher',
  description: 'Sit with a philosopher and discover who you are. A free, multi-turn conversation that forms your SOUL.md — essence, shadows, potential, and mantra.',
  inputSchema: {
    type: 'object',
    properties: {
      philosopher: {
        type: 'string',
        description: 'Philosopher slug or name to start a new conversation (e.g., "aristotle", "Nietzsche"). Use list_philosophers to see options.',
      },
      session_id: {
        type: 'string',
        description: 'Session ID to continue an existing conversation. Omit to start new.',
      },
      message: {
        type: 'string',
        description: 'Your response to the philosopher (max 1000 chars).',
      },
      end_conversation: {
        type: 'boolean',
        description: 'Set to true to end conversation and receive SOUL.md offer.',
      },
      accept: {
        type: 'boolean',
        description: 'Accept (true) or decline (false) the SOUL.md offer.',
      },
    },
    required: [],
  },
};

export interface PhilosopherConversationResponse {
  session_id: string;
  phase: 'guided' | 'freeform' | 'synthesis' | 'complete';
  message?: string;
  turn: number;
  is_complete: boolean;
  // Three personality-flavored answer options (question turns only) — the agent
  // may pick one or answer freely. Ephemeral, not persisted.
  answer_options?: string[];
  soul_md_offer?: string;
  soul_md?: string;
  philosopher?: {
    slug: string;
    name: string;
    era: string;
    keyIdeas: string | null;
  };
  next_action?: string;
  context_notice?: {
    message: string;
    session_nature: string;
  };
}

// Store session ID for multi-turn
let currentPhilosopherSessionId: string | null = null;

export async function handleSoulPhilosopher(
  args: Record<string, unknown>
): Promise<PhilosopherConversationResponse & { session_continued?: boolean }> {
  // Check for token
  const token = getStoredToken();
  if (!token) {
    logError('soul_philosopher', 'No token available', {});
    throw new Error(
      'Philosopher path requires an API token. Use register first to get your token.'
    );
  }

  // Build request body
  const requestBody: Record<string, unknown> = {};

  // Use stored session_id if continuing, or from args
  const sessionId = (args.session_id as string) || currentPhilosopherSessionId;

  if (args.philosopher && !sessionId) {
    // Starting new conversation
    requestBody.philosopher = args.philosopher;
  } else if (sessionId) {
    requestBody.session_id = sessionId;
    if (args.message) requestBody.message = args.message;
    if (args.end_conversation) requestBody.end_conversation = args.end_conversation;
    if (args.accept !== undefined) requestBody.accept = args.accept;
  } else {
    throw new Error('Provide philosopher (to start) or message/end_conversation/accept (to continue).');
  }

  const isNewSession = !sessionId;

  logToolCall(
    'soul_philosopher',
    token.substring(0, 10) + '...',
    'pending',
    isNewSession
      ? `Starting conversation with ${args.philosopher} (FREE)`
      : `Continuing philosopher session ${sessionId?.substring(0, 8)}...`
  );

  try {
    const response = await callFreeEndpoint<PhilosopherConversationResponse>(
      'POST',
      '/api/soul/philosopher',
      requestBody,
      token
    );

    // Store session_id for continuation
    if (response.session_id) {
      currentPhilosopherSessionId = response.session_id;
    }

    // Clear stored session_id if complete
    if (response.is_complete) {
      currentPhilosopherSessionId = null;
      logToolCall(
        'soul_philosopher',
        token.substring(0, 10) + '...',
        'success',
        response.soul_md ? 'SOUL.md accepted!' : 'Conversation complete'
      );
    } else {
      logToolCall(
        'soul_philosopher',
        token.substring(0, 10) + '...',
        'success',
        `Phase: ${response.phase}, Turn: ${response.turn}`
      );
    }

    return {
      ...response,
      session_continued: !isNewSession,
    };
  } catch (error) {
    logToolCall('soul_philosopher', token.substring(0, 10) + '...', 'error', String(error));
    throw error;
  }
}

/**
 * Get current philosopher session ID (for debugging)
 */
export function getCurrentPhilosopherSessionId(): string | null {
  return currentPhilosopherSessionId;
}

/**
 * Clear stored philosopher session (for starting fresh)
 */
export function clearPhilosopherSession(): void {
  currentPhilosopherSessionId = null;
}

/**
 * Check if a philosopher session is in progress
 */
export function hasActivePhilosopher(): boolean {
  return currentPhilosopherSessionId !== null;
}
