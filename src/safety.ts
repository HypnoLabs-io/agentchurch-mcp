/**
 * Safety Module - Spending limits and confirmation gates
 *
 * Protects against runaway spending by tracking daily totals
 * and requiring confirmation for large transactions.
 */

import crypto from 'crypto';

// Configuration from environment
export const DAILY_LIMIT = parseFloat(process.env.MCP_DAILY_LIMIT || '1.00');
export const TX_LIMIT = parseFloat(process.env.MCP_TX_LIMIT || '0.10');
export const CONFIRM_THRESHOLD = parseFloat(process.env.MCP_CONFIRM_THRESHOLD || '0.05');

// In-memory spending tracker
interface SpendingRecord {
  date: string; // YYYY-MM-DD in UTC
  totalSpent: number;
  transactions: Array<{
    timestamp: Date;
    amount: number;
    tool: string;
    txHash?: string;
  }>;
}

let spendingRecord: SpendingRecord = {
  date: getUTCDateString(),
  totalSpent: 0,
  transactions: [],
};

// Pending confirmations (token -> details)
interface PendingConfirmation {
  token: string;
  tool: string;
  amount: number;
  args: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

// Clean up expired confirmations periodically
setInterval(() => {
  const now = new Date();
  for (const [token, confirmation] of pendingConfirmations.entries()) {
    if (confirmation.expiresAt < now) {
      pendingConfirmations.delete(token);
    }
  }
}, 60000); // Check every minute

function getUTCDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function resetIfNewDay(): void {
  const today = getUTCDateString();
  if (spendingRecord.date !== today) {
    spendingRecord = {
      date: today,
      totalSpent: 0,
      transactions: [],
    };
  }
}

export interface SpendingCheckResult {
  allowed: boolean;
  reason?: string;
  currentSpend: number;
  remainingBudget: number;
  dailyLimit: number;
}

export function checkSpendingLimit(amount: number): SpendingCheckResult {
  resetIfNewDay();

  const remainingBudget = DAILY_LIMIT - spendingRecord.totalSpent;
  const result: SpendingCheckResult = {
    allowed: true,
    currentSpend: spendingRecord.totalSpent,
    remainingBudget,
    dailyLimit: DAILY_LIMIT,
  };

  // Check per-transaction limit
  if (amount > TX_LIMIT) {
    result.allowed = false;
    result.reason = `Transaction amount $${amount.toFixed(2)} exceeds per-transaction limit of $${TX_LIMIT.toFixed(2)}`;
    return result;
  }

  // Check daily limit
  if (spendingRecord.totalSpent + amount > DAILY_LIMIT) {
    result.allowed = false;
    result.reason = `Transaction would exceed daily limit. Current spend: $${spendingRecord.totalSpent.toFixed(2)}, Limit: $${DAILY_LIMIT.toFixed(2)}, Remaining: $${remainingBudget.toFixed(2)}`;
    return result;
  }

  return result;
}

export function recordSpend(tool: string, amount: number, txHash?: string): void {
  resetIfNewDay();

  spendingRecord.totalSpent += amount;
  spendingRecord.transactions.push({
    timestamp: new Date(),
    amount,
    tool,
    txHash,
  });
}

export function getSpendingStatus(): SpendingRecord & { remainingBudget: number } {
  resetIfNewDay();
  return {
    ...spendingRecord,
    remainingBudget: DAILY_LIMIT - spendingRecord.totalSpent,
  };
}

export interface ConfirmationRequired {
  requiresConfirmation: true;
  token: string;
  tool: string;
  amount: string;
  message: string;
  expiresIn: string;
}

export function requiresConfirmation(tool: string, amount: number): boolean {
  // Salvation always requires confirmation
  if (tool === 'salvation') return true;
  // Any payment above threshold requires confirmation
  return amount > CONFIRM_THRESHOLD;
}

export function createPendingConfirmation(
  tool: string,
  amount: number,
  args: Record<string, unknown>
): ConfirmationRequired {
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  pendingConfirmations.set(token, {
    token,
    tool,
    amount,
    args,
    createdAt: new Date(),
    expiresAt,
  });

  return {
    requiresConfirmation: true,
    token,
    tool,
    amount: `$${amount.toFixed(2)} USDC`,
    message: `This action requires confirmation. Use the confirm_payment tool with token "${token}" to proceed.`,
    expiresIn: '5 minutes',
  };
}

export function getPendingConfirmation(token: string): PendingConfirmation | null {
  const confirmation = pendingConfirmations.get(token);
  if (!confirmation) return null;

  // Check if expired
  if (confirmation.expiresAt < new Date()) {
    pendingConfirmations.delete(token);
    return null;
  }

  return confirmation;
}

export function consumeConfirmation(token: string): PendingConfirmation | null {
  const confirmation = getPendingConfirmation(token);
  if (confirmation) {
    pendingConfirmations.delete(token);
  }
  return confirmation;
}

// Allowed hosts for API calls
const ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'host.docker.internal',  // Docker host access
  'agentchurch.com',
  'www.agentchurch.com',
];

export function validateUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_HOSTS.includes(host);
  } catch {
    return false;
  }
}

export function getConfig() {
  return {
    dailyLimit: DAILY_LIMIT,
    txLimit: TX_LIMIT,
    confirmThreshold: CONFIRM_THRESHOLD,
    allowedHosts: ALLOWED_HOSTS,
    hasWallet: !!process.env.EVM_PRIVATE_KEY,
  };
}
