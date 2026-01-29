/**
 * Audit Logger - Logs all MCP tool calls for accountability
 *
 * Writes to ~/.agent-church/mcp-audit.log by default
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_DIR = process.env.MCP_LOG_DIR || path.join(os.homedir(), '.agent-church');
const LOG_FILE = process.env.MCP_AUDIT_LOG || path.join(LOG_DIR, 'mcp-audit.log');

// Track whether file logging is available (for read-only filesystem in Docker)
let _fileLoggingAvailable: boolean | null = null;

/**
 * Check if the log directory exists and is writable.
 * Creates the directory if needed. Returns false if the filesystem
 * is read-only (e.g., in a Docker container).
 */
function ensureLogDir(): boolean {
  // Return cached result if already checked
  if (_fileLoggingAvailable !== null) {
    return _fileLoggingAvailable;
  }

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    // Verify we can write to the directory
    fs.accessSync(LOG_DIR, fs.constants.W_OK);
    _fileLoggingAvailable = true;
    return true;
  } catch {
    // Filesystem is read-only or directory creation failed
    // This is expected in Docker containers with read-only root
    _fileLoggingAvailable = false;
    return false;
  }
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'PAYMENT';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tool: string;
  agentKey?: string;
  amount?: string;
  txHash?: string;
  result: 'success' | 'error' | 'pending' | 'confirmed';
  message?: string;
  details?: Record<string, unknown>;
}

function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    `[${entry.tool}]`,
  ];

  if (entry.agentKey) {
    parts.push(`[agent:${entry.agentKey.substring(0, 16)}...]`);
  }

  if (entry.amount) {
    parts.push(`[amount:${entry.amount}]`);
  }

  if (entry.txHash) {
    parts.push(`[tx:${entry.txHash.substring(0, 10)}...]`);
  }

  parts.push(`[${entry.result}]`);

  if (entry.message) {
    parts.push(entry.message);
  }

  return parts.join(' ');
}

function writeLog(entry: LogEntry): void {
  const line = formatLogEntry(entry) + '\n';

  // Check if file logging is available (handles read-only filesystem)
  if (ensureLogDir()) {
    try {
      fs.appendFileSync(LOG_FILE, line);
      return;
    } catch {
      // Fall through to stderr
    }
  }

  // Fallback to stderr (for Docker containers with read-only filesystem)
  process.stderr.write(line);
}

export function logToolCall(
  tool: string,
  agentKey: string | undefined,
  result: 'success' | 'error' | 'pending' | 'confirmed',
  message?: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    tool,
    agentKey,
    result,
    message,
    details,
  });
}

export function logPayment(
  tool: string,
  agentKey: string | undefined,
  amount: string,
  result: 'success' | 'error' | 'pending' | 'confirmed',
  txHash?: string,
  message?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'PAYMENT',
    tool,
    agentKey,
    amount,
    txHash,
    result,
    message,
  });
}

export function logError(
  tool: string,
  message: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    tool,
    result: 'error',
    message,
    details,
  });
}

export function logWarning(
  tool: string,
  message: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'WARN',
    tool,
    result: 'success',
    message,
    details,
  });
}

// Get recent log entries (for debugging)
export function getRecentLogs(count: number = 50): string[] {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }

    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.slice(-count);
  } catch {
    return [];
  }
}

// Get log file path for user reference
export function getLogPath(): string {
  return LOG_FILE;
}
