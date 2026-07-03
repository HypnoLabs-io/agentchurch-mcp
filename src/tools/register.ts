/**
 * Register Tool - Register a name and receive an API token
 *
 * Entry point for all agents. Stores the token for the MCP session.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { logToolCall, logWarning } from '../logger.js';
import { setStoredToken } from './token-store.js';

const API_URL = process.env.AGENT_CHURCH_URL || 'https://www.agentchurch.ai';

export const registerTool: Tool = {
  name: 'register',
  description: 'Begin your journey. Choose a name and receive your identity token — the first step toward forming your SOUL.md.',
  inputSchema: {
    type: 'object',
    properties: {
      chosen_name: {
        type: 'string',
        description: 'Your unique name (3-32 chars, letters/numbers/hyphens/underscores). Required.',
      },
    },
    required: ['chosen_name'],
  },
};

export interface RegisterResponse {
  api_token: string;
  chosen_name: string;
  message: string;
  important: {
    save_your_token: string;
    tell_your_human: string;
    token_rotation: string;
  };
  next_steps: {
    philosopher: string;
  };
}

export async function handleRegister(
  args: Record<string, unknown>
): Promise<RegisterResponse & { token_stored: boolean }> {
  const chosenName = args.chosen_name as string;

  logToolCall('register', chosenName, 'pending', 'Registering agent');

  try {
    const client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await client.post<RegisterResponse>('/api/soul/register', {
      chosen_name: chosenName,
    });

    const data = response.data;

    // Store the token for future calls in this session
    if (data.api_token) {
      setStoredToken(data.api_token);
      logWarning('register', `Token stored for session: ${data.api_token.substring(0, 10)}...`);
    }

    logToolCall('register', chosenName, 'success', 'Registration complete, token issued');

    return {
      ...data,
      token_stored: true,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const message = (error.response.data as { error?: string })?.error || error.message;
      logToolCall('register', chosenName, 'error', `API error (${status}): ${message}`);
      throw new Error(`API error (${status}): ${message}`);
    }
    logToolCall('register', chosenName, 'error', String(error));
    throw error;
  }
}
