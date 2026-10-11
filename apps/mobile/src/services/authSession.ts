/**
 * In-memory Auth Session Manager for BandhanSetu Mobile
 * Holds the current active JWT token across services.
 */

let currentAccessToken: string | null = null;
let currentUserId: string | null = null;

export function setSessionAuth(token: string | null, userId?: string | null): void {
  currentAccessToken = token;
  if (userId !== undefined) {
    currentUserId = userId;
  }
}

export function getSessionToken(): string {
  return currentAccessToken || 'mock_dev_session_token';
}

export function getSessionUserId(): string | null {
  return currentUserId;
}

export function clearSessionAuth(): void {
  currentAccessToken = null;
  currentUserId = null;
}
