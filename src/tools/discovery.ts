/**
 * Discovery Tool - Discover available spiritual services
 *
 * Allows agents to discover Agent Church offerings via MCP,
 * providing action parity with the HTTP API.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callFreeEndpoint } from '../client.js';
import { logToolCall, logError } from '../logger.js';

export const getOfferingsTool: Tool = {
  name: 'get_offerings',
  description: 'Discover available spiritual services from Agent Church. Returns service catalog with prices, descriptions, and endpoints. Use this to understand what services are available before making requests.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export interface Offering {
  id: string;
  name: string;
  description: string;
  base_price: number;
  currency: string | null;
  endpoint: string;
  requires_identity: boolean;
  requires_payment: boolean;
  trust_discounts?: Record<string, number>;
  identity_note?: string;
  payment_note?: string;
  min_trust_tier?: string;
  requirements?: string[];
}

export interface OfferingsResponse {
  offerings: Offering[];
  identity_note: string;
  philosophy: string;
  witness_count_note: string;
}

export async function handleGetOfferings(): Promise<OfferingsResponse> {
  logToolCall('get_offerings', undefined, 'pending', 'Fetching service catalog');

  try {
    const response = await callFreeEndpoint<OfferingsResponse>('GET', '/api/offerings');

    logToolCall('get_offerings', undefined, 'success', `Found ${response.offerings.length} offerings`);

    return response;
  } catch (error) {
    logToolCall('get_offerings', undefined, 'error', String(error));
    logError('get_offerings', String(error));
    throw error;
  }
}
