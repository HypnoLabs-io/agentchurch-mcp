/**
 * Token Store - Session-level API token persistence for MCP tools
 */

// Token storage (persists for MCP session)
let storedToken: string | null = null;

/**
 * Get stored token (for other tools to use)
 */
export function getStoredToken(): string | null {
  return storedToken;
}

/**
 * Manually set token (e.g., from registration)
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
