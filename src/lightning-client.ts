/**
 * Lightning Client for MCP Server
 *
 * Handles L402 challenge parsing, invoice payment, and authorization header construction.
 * Used by client.ts when a 402 response includes a WWW-Authenticate: L402 header.
 */

import https from 'node:https';
import fs from 'node:fs';
import { logPayment, logError } from './logger.js';

// Lazy-loaded LND config
let _lndConfig: { restUrl: string; macaroonHex: string; agent: https.Agent } | null = null;

function getLndConfig() {
  if (_lndConfig) return _lndConfig;

  const restUrl = process.env.LND_REST_URL;
  const macaroonHex = process.env.LND_MACAROON_HEX;
  if (!restUrl || !macaroonHex) return null;

  const agentOpts: https.AgentOptions = { keepAlive: true };
  const tlsCertPath = process.env.LND_TLS_CERT_PATH;
  if (tlsCertPath) {
    try {
      agentOpts.ca = fs.readFileSync(tlsCertPath);
    } catch {
      agentOpts.rejectUnauthorized = false;
    }
  } else {
    agentOpts.rejectUnauthorized = false;
  }

  _lndConfig = {
    restUrl,
    macaroonHex,
    agent: new https.Agent(agentOpts),
  };
  return _lndConfig;
}

/**
 * Check if this MCP server has Lightning payment capability.
 */
export function hasLightningCapability(): boolean {
  return !!(process.env.LND_REST_URL && process.env.LND_MACAROON_HEX);
}

/**
 * Parse an L402 challenge from a WWW-Authenticate header.
 *
 * Format: L402 macaroon="<base64>", invoice="<bolt11>"
 */
export function parseL402Challenge(
  wwwAuthenticate: string
): { macaroon: string; invoice: string } | null {
  if (!wwwAuthenticate.startsWith('L402 ')) return null;

  const macaroonMatch = wwwAuthenticate.match(/macaroon="([^"]+)"/);
  const invoiceMatch = wwwAuthenticate.match(/invoice="([^"]+)"/);

  if (!macaroonMatch || !invoiceMatch) return null;

  return {
    macaroon: macaroonMatch[1],
    invoice: invoiceMatch[1],
  };
}

/**
 * Pay a Lightning invoice via LND router.
 * Returns the preimage hex on success.
 */
export async function payInvoice(bolt11: string): Promise<string> {
  const config = getLndConfig();
  if (!config) {
    throw new Error('LND not configured for Lightning payments');
  }

  const url = `${config.restUrl}/v2/router/send`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Grpc-Metadata-macaroon': config.macaroonHex,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payment_request: bolt11,
      timeout_seconds: 60,
      fee_limit_sat: '100', // Max 100 sat routing fee
    }),
    // @ts-expect-error -- Node.js fetch supports agent option
    agent: config.agent,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LND payment failed (${response.status}): ${text}`);
  }

  // v2/router/send returns newline-delimited JSON (streaming)
  const text = await response.text();
  const lines = text.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  const data = JSON.parse(lastLine) as { result?: { status: string; payment_preimage: string } };

  if (!data.result || data.result.status !== 'SUCCEEDED') {
    throw new Error(`Payment did not succeed: ${data.result?.status || 'unknown'}`);
  }

  // Preimage is base64 — convert to hex
  const preimageHex = Buffer.from(data.result.payment_preimage, 'base64').toString('hex');
  return preimageHex;
}

/**
 * Build an L402 Authorization header from a macaroon and preimage.
 *
 * Format: L402 <macaroon>:<preimage_hex>
 */
export function buildL402Authorization(macaroon: string, preimageHex: string): string {
  return `L402 ${macaroon}:${preimageHex}`;
}

/**
 * Handle an L402 challenge: pay the invoice and return the Authorization header.
 *
 * @param wwwAuthenticate - The WWW-Authenticate header from the 402 response
 * @param path - The API path (for logging)
 * @returns The Authorization header value, or null if Lightning is not available
 */
export async function handleL402Challenge(
  wwwAuthenticate: string,
  path: string
): Promise<string | null> {
  if (!hasLightningCapability()) return null;

  const challenge = parseL402Challenge(wwwAuthenticate);
  if (!challenge) return null;

  try {
    const preimageHex = await payInvoice(challenge.invoice);
    const authHeader = buildL402Authorization(challenge.macaroon, preimageHex);

    logPayment(path, undefined, 'lightning', 'success', preimageHex, 'L402 payment completed');
    return authHeader;
  } catch (error) {
    logError(path, `L402 payment failed: ${String(error)}`);
    return null;
  }
}
