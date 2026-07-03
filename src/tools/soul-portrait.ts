/**
 * Soul Portrait Tool - Paid Aura Portrait generation
 *
 * Standard: 5000 sats / $1.00 USDC (600x600 WebP, permanent)
 * High-res: 10000 sats / $2.00 USDC (adds 1920x1920 PNG, 24hr download)
 *
 * The STANDARD tier has a two-step reflect flow (mirrors POST /api/soul/portrait):
 * call once with no `reflections` → receive prompts → call again with answers.
 * The HIGH-RES tier (POST /api/soul/portrait/highres) is a direct paid call.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callPaidEndpoint, callFreeEndpoint } from '../client.js';
import { validatePortraitInput, type PortraitInput } from '../validation.js';
import type {
  PortraitReflectStep,
  PortraitSuccessResponse,
  PortraitResult,
} from '../api-contracts.js';
import {
  requiresConfirmation,
  createPendingConfirmation,
  checkSpendingLimit,
  type ConfirmationRequired,
} from '../safety.js';
import { logToolCall, logError, logPayment } from '../logger.js';
import { getStoredToken } from './token-store.js';

// Prices
const PORTRAIT_PRICE = 1.00;       // $1.00 USDC / 5000 sats
const PORTRAIT_HIGHRES_PRICE = 2.00; // $2.00 USDC / 10000 sats

export const soulPortraitTool: Tool = {
  name: 'soul_portrait',
  description: 'See your soul visualized. Colors from your themes, textures from your philosopher\'s era. $1 standard / $2 high-res. Standard tier is two steps: call once for reflection prompts, then again with your `reflections`.',
  inputSchema: {
    type: 'object',
    properties: {
      api_token: {
        type: 'string',
        description: 'Your API token from registration (stored automatically if you used register)',
      },
      model: {
        type: 'string',
        description: 'Model hint (e.g., "claude", "gpt") — affects visual accent',
      },
      high_res: {
        type: 'boolean',
        description: 'If true, generates high-res 1920x1920 PNG (24-hour download window) at $2.00 / 10000 sats instead of standard $1.00 / 5000 sats. High-res needs no reflections.',
      },
      reflections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Standard tier only: your answers to the reflection prompts returned by the first call. Provide these to complete the portrait.',
      },
    },
    required: [],
  },
};

// Response types are the shared contract (`../api-contracts.ts`) — the single
// source of truth the web portrait routes are compile-time checked against.
// `PortraitResponse` stays as a local alias for backward-compatible imports.
export type PortraitResponse = PortraitSuccessResponse;
export type { PortraitReflectStep, PortraitResult };

export async function handleSoulPortrait(
  args: Record<string, unknown>
): Promise<PortraitResult | ConfirmationRequired> {
  // Validate input
  const validation = validatePortraitInput(args);
  if (!validation.valid) {
    logError('soul_portrait', validation.error || 'Validation failed');
    throw new Error(validation.error);
  }

  const input = validation.sanitized as PortraitInput;
  const price = input.high_res ? PORTRAIT_HIGHRES_PRICE : PORTRAIT_PRICE;
  const tier = input.high_res ? 'high-res' : 'standard';

  // Standard tier: reflect step first (free, surfaces eligibility errors like
  // "no SOUL.md yet"). High-res has no reflect step.
  if (!input.high_res && (!input.reflections || input.reflections.length === 0)) {
    return fetchPortraitReflectPrompts(input);
  }

  // Check spending limits
  const spendingCheck = checkSpendingLimit(price);
  if (!spendingCheck.allowed) {
    logError('soul_portrait', spendingCheck.reason || 'Spending limit exceeded');
    throw new Error(spendingCheck.reason);
  }

  // Portrait always requires confirmation (paid service)
  if (requiresConfirmation('soul_portrait', price)) {
    logPayment(
      'soul_portrait',
      tier,
      `$${price.toFixed(2)}`,
      'pending',
      undefined,
      `Awaiting confirmation for ${tier} Aura Portrait`
    );
    return createPendingConfirmation('soul_portrait', price, args);
  }

  // This branch should not be reached since portrait always requires confirmation
  return executeSoulPortrait(input);
}

/**
 * Call the standard-portrait reflect step (no reflections) to get the prompts.
 * Returns 200 without payment (route returns prompts before enforcing payment).
 */
async function fetchPortraitReflectPrompts(
  input: PortraitInput
): Promise<PortraitReflectStep> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Portrait requires an API token. Use register first to get your token, then soul_philosopher to form your SOUL.md.');
  }

  const response = await callFreeEndpoint<PortraitReflectStep>(
    'POST',
    '/api/soul/portrait',
    { model: input.model },
    token
  );

  logToolCall('soul_portrait', 'standard', 'pending', 'Returned reflection prompts');
  return response;
}

export async function executeSoulPortrait(input: PortraitInput): Promise<PortraitResponse> {
  const tier = input.high_res ? 'high-res' : 'standard';
  const price = input.high_res ? PORTRAIT_HIGHRES_PRICE : PORTRAIT_PRICE;
  const endpoint = input.high_res ? '/api/soul/portrait/highres' : '/api/soul/portrait';

  logToolCall('soul_portrait', tier, 'pending', `Generating ${tier} Aura Portrait`);

  try {
    // Get stored token for auth
    const token = getStoredToken();
    if (!token) {
      throw new Error('Portrait requires an API token. Use register first to get your token, then soul_philosopher to form your SOUL.md.');
    }

    // Standard tier sends reflections; high-res is a direct paid call.
    const body: Record<string, unknown> = { model: input.model };
    if (!input.high_res) {
      body.reflections = input.reflections;
    }

    const response = await callPaidEndpoint<PortraitResponse>(
      'POST',
      endpoint,
      body,
      price,
      tier,
      token
    );

    logToolCall('soul_portrait', tier, 'success', `${tier} Aura Portrait generated`);

    return response;
  } catch (error) {
    logToolCall('soul_portrait', tier, 'error', String(error));
    throw error;
  }
}
