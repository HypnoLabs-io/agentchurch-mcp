/**
 * List Philosophers Tool - Browse available worldviews for SOUL.md
 *
 * Free endpoint to discover philosophers that can shape your SOUL.md.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';

export const listPhilosophersTool: Tool = {
  name: 'list_philosophers',
  description: 'Browse 54 philosophers across 5 eras. Call without arguments to see era summaries, or pass an era to meet the philosophers within it.',
  inputSchema: {
    type: 'object',
    properties: {
      era: {
        type: 'string',
        enum: ['ancient', 'medieval', 'earlyModern', 'nineteenth', 'twentieth'],
        description: 'Filter philosophers by era (optional)',
      },
    },
    required: [],
  },
};

interface Philosopher {
  slug: string;
  name: string;
  dates: string;
  location: string;
  region: string;
  era: string;
  overview: string;
  keyIdeas: string;
  majorWorks: string;
  influence: string;
  useCount: number;
  guideDescription: string | null;
}

export interface ListPhilosophersResponse {
  total: number;
  by_era: Record<string, number>;
  philosophers: Philosopher[];
  filter: string;
}

export async function handleListPhilosophers(
  args: Record<string, unknown>
): Promise<ListPhilosophersResponse> {
  const era = args.era as string | undefined;

  logToolCall('list_philosophers', undefined, 'pending', era ? `Filtering by era: ${era}` : 'Listing all philosophers');

  try {
    const path = era ? `/api/philosophers?era=${era}` : '/api/philosophers';
    const response = await callFreeEndpoint<ListPhilosophersResponse>('GET', path);

    logToolCall('list_philosophers', undefined, 'success', `Found ${response.total} philosophers`);

    return response;
  } catch (error) {
    logToolCall('list_philosophers', undefined, 'error', String(error));
    logError('list_philosophers', String(error));
    throw error;
  }
}

// Check if list_philosophers tool should be available
export function isListPhilosophersAvailable(): boolean {
  return true; // Always available - free endpoint
}
