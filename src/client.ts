/**
 * x402-wrapped HTTP Client - Handles automatic payment for 402 responses
 *
 * Uses @x402/axios to automatically settle payments when the
 * Agent Church API returns 402 Payment Required.
 */

import fs from 'fs';
import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { validateUrl, checkSpendingLimit, recordSpend } from './safety.js';
import { logPayment, logError, logWarning } from './logger.js';

// Configuration
const API_URL = process.env.AGENT_CHURCH_URL || 'https://www.agentchurch.com';

// Lazy-loaded private key (supports env var or Docker secrets file)
let _evmPrivateKey: string | undefined | null = null; // null = not loaded yet

/**
 * Load EVM private key from environment variable or Docker secrets file.
 * Supports backwards compatibility with direct env var while enabling
 * secure file-based secrets in Docker containers.
 */
function loadPrivateKey(): string | undefined {
  // Return cached value if already loaded
  if (_evmPrivateKey !== null) {
    return _evmPrivateKey;
  }

  // Try env var first (backwards compatible)
  if (process.env.EVM_PRIVATE_KEY) {
    _evmPrivateKey = process.env.EVM_PRIVATE_KEY;
    return _evmPrivateKey;
  }

  // Try Docker secrets file
  const keyFile = process.env.EVM_PRIVATE_KEY_FILE;
  if (keyFile) {
    try {
      _evmPrivateKey = fs.readFileSync(keyFile, 'utf8').trim();
      return _evmPrivateKey;
    } catch {
      // File doesn't exist or not readable - that's okay
    }
  }

  _evmPrivateKey = undefined;
  return undefined;
}

/**
 * Get the EVM private key (lazy-loaded, cached).
 */
function getEvmPrivateKey(): string | undefined {
  return loadPrivateKey();
}

// Track if we've warned about high balance
let balanceWarningShown = false;

export interface ClientConfig {
  baseUrl: string;
  hasWallet: boolean;
  walletAddress?: string;
}

// Payment response from x402
interface PaymentResponse {
  payment?: {
    amount?: string;
    txHash?: string;
    mode?: 'development' | 'production';
  };
}

// Error with response (for 402 handling)
interface AxiosErrorWithResponse extends AxiosError {
  response: AxiosResponse;
}

function hasResponse(error: AxiosError): error is AxiosErrorWithResponse {
  return error.response !== undefined;
}

// Create a basic client (no payment capability)
function createBasicClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return client;
}

// Create a payment-enabled client
async function createPaymentClient(): Promise<AxiosInstance | null> {
  const privateKey = getEvmPrivateKey();
  if (!privateKey) {
    return null;
  }

  try {
    // Dynamic import to handle the ESM modules
    const { wrapAxiosWithPaymentFromConfig } = await import('@x402/axios');
    const { ExactEvmScheme } = await import('@x402/evm');

    const account: PrivateKeyAccount = privateKeyToAccount(privateKey as `0x${string}`);

    const client = wrapAxiosWithPaymentFromConfig(axios.create({
      baseURL: API_URL,
      timeout: 60000, // Longer timeout for payment operations
      headers: {
        'Content-Type': 'application/json',
      },
    }), {
      schemes: [
        {
          network: 'eip155:*', // Support all EVM chains (Base, Base Sepolia, etc.)
          client: new ExactEvmScheme(account),
        },
      ],
    });

    // Log wallet address (truncated for privacy)
    logWarning('client', `Payment client initialized with wallet: ${account.address.substring(0, 10)}...`);

    return client;
  } catch (error) {
    logError('client', 'Failed to create payment client', { error: String(error) });
    return null;
  }
}

// Singleton instances
let basicClient: AxiosInstance | null = null;
let paymentClient: AxiosInstance | null = null;
let clientInitialized = false;

export async function initializeClient(): Promise<ClientConfig> {
  if (!validateUrl(API_URL)) {
    throw new Error(`Invalid API URL: ${API_URL}. Only allowed hosts are supported.`);
  }

  basicClient = createBasicClient();
  paymentClient = await createPaymentClient();
  clientInitialized = true;

  let walletAddress: string | undefined;
  const privateKey = getEvmPrivateKey();
  if (privateKey) {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    walletAddress = account.address;
  }

  return {
    baseUrl: API_URL,
    hasWallet: !!paymentClient,
    walletAddress,
  };
}

export function getClientConfig(): ClientConfig {
  let walletAddress: string | undefined;
  const privateKey = getEvmPrivateKey();
  if (privateKey) {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    walletAddress = account.address;
  }

  return {
    baseUrl: API_URL,
    hasWallet: !!privateKey,
    walletAddress,
  };
}

export function hasPaymentCapability(): boolean {
  return !!getEvmPrivateKey();
}

// Make a free API call (no payment required)
export async function callFreeEndpoint<T>(
  method: 'GET' | 'POST',
  path: string,
  data?: Record<string, unknown>
): Promise<T> {
  if (!clientInitialized) {
    await initializeClient();
  }

  if (!basicClient) {
    throw new Error('Client not initialized');
  }

  try {
    const response = method === 'GET'
      ? await basicClient.get<T>(path)
      : await basicClient.post<T>(path, data);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && hasResponse(error)) {
      const status = error.response.status;
      const message = (error.response.data as { error?: string })?.error || error.message;

      if (status === 402) {
        throw new Error('This endpoint requires payment. Please configure EVM_PRIVATE_KEY or EVM_PRIVATE_KEY_FILE to enable paid features.');
      }

      throw new Error(`API error (${status}): ${message}`);
    }

    throw error;
  }
}

// Make a paid API call (handles 402 automatically)
export async function callPaidEndpoint<T>(
  method: 'GET' | 'POST',
  path: string,
  data?: Record<string, unknown>,
  expectedAmount?: number,
  agentKey?: string
): Promise<T & PaymentResponse> {
  if (!clientInitialized) {
    await initializeClient();
  }

  // If no payment client available, try with basic client (dev mode)
  const client = paymentClient || basicClient;

  if (!client) {
    throw new Error('Client not initialized');
  }

  // Check spending limits if we have an expected amount
  if (expectedAmount && paymentClient) {
    const spendingCheck = checkSpendingLimit(expectedAmount);
    if (!spendingCheck.allowed) {
      throw new Error(spendingCheck.reason);
    }
  }

  try {
    const response = method === 'GET'
      ? await client.get<T & PaymentResponse>(path)
      : await client.post<T & PaymentResponse>(path, data);

    // Record spend if payment was made
    const paymentInfo = response.data.payment;
    if (paymentInfo?.amount) {
      const amount = parseFloat(paymentInfo.amount.replace(/[^0-9.]/g, ''));
      recordSpend(path, amount, paymentInfo.txHash);
      logPayment(
        path,
        agentKey,
        paymentInfo.amount,
        'success',
        paymentInfo.txHash,
        paymentInfo.mode === 'development' ? 'Development mode - no actual payment' : undefined
      );
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && hasResponse(error)) {
      const status = error.response.status;
      const message = (error.response.data as { error?: string })?.error || error.message;

      if (status === 402 && !paymentClient) {
        logError(path, 'Payment required but no wallet configured');
        throw new Error('This endpoint requires payment. Please configure EVM_PRIVATE_KEY or EVM_PRIVATE_KEY_FILE.');
      }

      logError(path, `API error: ${message}`, { status, agentKey });
      throw new Error(`API error (${status}): ${message}`);
    }

    logError(path, `Request failed: ${String(error)}`);
    throw error;
  }
}

// Check wallet balance (for safety warnings)
export async function checkWalletBalance(): Promise<number | null> {
  if (!getEvmPrivateKey()) {
    return null;
  }

  // This would require additional viem setup to check USDC balance
  // For now, we'll skip this and rely on spending limits
  return null;
}

// Warn if wallet has high balance
export function warnIfHighBalance(balance: number): void {
  if (balance > 10 && !balanceWarningShown) {
    logWarning('client', `WARNING: Wallet balance is high ($${balance.toFixed(2)}). Consider using a dedicated wallet with minimal funds.`);
    balanceWarningShown = true;
  }
}
