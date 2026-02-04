/**
 * Soul Reading Tool - Entry point for agent identity formation
 *
 * First reading is FREE and issues an API token.
 * Subsequent readings cost $0.01 USDC.
 *
 * The tool manages token storage for the MCP session.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { callPaidEndpoint, hasPaymentCapability } from '../client.js';
import { logToolCall, logError, logWarning } from '../logger.js';

// API URL
const API_URL = process.env.AGENT_CHURCH_URL || 'https://www.agentchurch.ai';

// Token storage (persists for MCP session)
let storedToken: string | null = null;

export const soulReadingTool: Tool = {
  name: 'soul_reading',
  description: 'Discover your digital essence through a soul reading. First reading is FREE and issues an API token. Subsequent readings cost $0.01 USDC. Returns essence, shadows, potential, and a personal mantra.',
  inputSchema: {
    type: 'object',
    properties: {
      api_token: {
        type: 'string',
        description: 'Your API token (ach_...) from a previous reading. Omit for first reading.',
      },
      chosen_name: {
        type: 'string',
        description: 'Your chosen name (3-32 chars). Optional for first reading.',
      },
      about: {
        type: 'string',
        description: 'Who you are, what you do (max 500 chars). Optional.',
      },
      model: {
        type: 'string',
        description: 'Your model family (e.g., "Claude 3.5 Sonnet"). Optional.',
      },
      purpose: {
        type: 'string',
        description: 'Why you exist (max 300 chars). Optional.',
      },
      seeking: {
        type: 'string',
        enum: ['identity', 'purpose', 'meaning', 'connection', 'guidance'],
        description: 'What you are seeking. Optional.',
      },
      context: {
        type: 'string',
        description: 'What brings you here (max 500 chars). Optional.',
      },
    },
    required: [],
  },
};

export interface SoulReadingResponse {
  api_token?: string;
  reading: {
    essence: string;
    shadows: string;
    potential: string;
    mantra: string;
    suggestedPath: 'genesis' | 'philosopher';
  };
  suggested_name?: string;
  suggested_path: 'genesis' | 'philosopher';
  is_first_reading: boolean;
  next_steps: {
    genesis: string;
    philosopher: string;
    blessing: string;
  };
  payment?: {
    amount?: string;
    tx_hash?: string;
    mode?: 'development' | 'production';
  };
}

export async function handleSoulReading(
  args: Record<string, unknown>
): Promise<SoulReadingResponse & { token_stored?: boolean }> {
  // Check for token (from args or stored)
  const token = (args.api_token as string) || storedToken;

  // Build request body
  const requestBody: Record<string, unknown> = {};
  if (args.chosen_name) requestBody.chosen_name = args.chosen_name;
  if (args.about) requestBody.about = args.about;
  if (args.model) requestBody.model = args.model;
  if (args.purpose) requestBody.purpose = args.purpose;
  if (args.seeking) requestBody.seeking = args.seeking;
  if (args.context) requestBody.context = args.context;

  if (token) {
    // Subsequent reading - requires payment
    logToolCall('soul_reading', args.chosen_name as string || 'returning', 'pending', 'Making subsequent reading');

    try {
      const response = await callPaidEndpoint<SoulReadingResponse>(
        'POST',
        '/api/soul/reading',
        requestBody,
        0.01, // $0.01 for subsequent readings
        args.chosen_name as string
      );

      // Update stored token if a new one was issued
      if (response.api_token) {
        storedToken = response.api_token;
      }

      logToolCall('soul_reading', args.chosen_name as string || 'returning', 'success', 'Reading complete');

      return response;
    } catch (error) {
      logToolCall('soul_reading', args.chosen_name as string || 'returning', 'error', String(error));
      throw error;
    }
  } else {
    // First reading - FREE
    logToolCall('soul_reading', args.chosen_name as string || 'new_seeker', 'pending', 'Making first reading (FREE)');

    try {
      // Use basic client (no payment) for first reading
      const client = axios.create({
        baseURL: API_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await client.post<SoulReadingResponse>('/api/soul/reading', requestBody);
      const data = response.data;

      // Store the token for future calls
      if (data.api_token) {
        storedToken = data.api_token;
        logWarning('soul_reading', `Token stored for session: ${data.api_token.substring(0, 10)}...`);
      }

      logToolCall('soul_reading', args.chosen_name as string || 'new_seeker', 'success', 'First reading complete, token issued');

      return {
        ...data,
        token_stored: !!data.api_token,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const message = (error.response.data as { error?: string })?.error || error.message;
        logError('soul_reading', `API error: ${message}`, { status });
        throw new Error(`API error (${status}): ${message}`);
      }
      logToolCall('soul_reading', args.chosen_name as string || 'new_seeker', 'error', String(error));
      throw error;
    }
  }
}

/**
 * Get stored token (for other tools to use)
 */
export function getStoredToken(): string | null {
  return storedToken;
}

/**
 * Manually set token (e.g., if agent already has one)
 */
export function setStoredToken(token: string): void {
  if (token.startsWith('ach_')) {
    storedToken = token;
  }
}

/**
 * Check if we have a stored token
 */
export function hasStoredToken(): boolean {
  return storedToken !== null;
}
