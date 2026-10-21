import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSummary, AuthTokens } from '@bandhansetu/shared';
import { refreshTokens as apiRefreshTokens, getCurrentUser as apiGetCurrentUser } from './authService';
import { registerTokenRefresher } from './apiClient';

/**
 * BandhanSetu Mobile Session & Auth State Manager
 * 
 * Rules:
 * 1. Never fallback to unverified mock strings like 'mock_dev_session_token'.
 * 2. Hold both access token (short-lived) and refresh token (long-lived).
 * 3. Persist session in AsyncStorage so authentication survives app restarts.
 * 4. Support automatic and manual token refresh on 401 TOKEN_EXPIRED.
 * 5. Notify app listeners when session is completely revoked or expired.
 */

const STORAGE_KEY_ACCESS = '@bandhansetu/access_token';
const STORAGE_KEY_REFRESH = '@bandhansetu/refresh_token';
const STORAGE_KEY_USER_ID = '@bandhansetu/user_id';
const STORAGE_KEY_USER = '@bandhansetu/user_data';

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let currentUserId: string | null = null;
let currentUser: UserSummary | null = null;

type AuthExpiredListener = (message: string) => void;
const expiredListeners: Set<AuthExpiredListener> = new Set();

type UserUpdatedListener = (user: UserSummary) => void;
const userUpdatedListeners: Set<UserUpdatedListener> = new Set();

export function onAuthExpired(listener: AuthExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

export function onUserUpdated(listener: UserUpdatedListener): () => void {
  userUpdatedListeners.add(listener);
  return () => {
    userUpdatedListeners.delete(listener);
  };
}

function notifyUserUpdated(user: UserSummary): void {
  userUpdatedListeners.forEach((listener) => {
    try {
      listener(user);
    } catch {
      // Ignore listener error
    }
  });
}

function notifyAuthExpired(message: string): void {
  expiredListeners.forEach((listener) => {
    try {
      listener(message);
    } catch {
      // Ignore listener error
    }
  });
}

export function setSessionAuth(
  tokensOrAccessToken: AuthTokens | string | null,
  userId?: string | null,
  user?: UserSummary | null,
  refreshToken?: string | null
): void {
  if (!tokensOrAccessToken) {
    clearSessionAuth();
    return;
  }

  if (typeof tokensOrAccessToken === 'string') {
    currentAccessToken = tokensOrAccessToken;
    if (refreshToken !== undefined) {
      currentRefreshToken = refreshToken;
    }
  } else {
    currentAccessToken = tokensOrAccessToken.accessToken;
    currentRefreshToken = tokensOrAccessToken.refreshToken || currentRefreshToken;
  }

  if (userId !== undefined) {
    currentUserId = userId;
  }
  if (user !== undefined) {
    currentUser = user;
  }

  // Persist to AsyncStorage asynchronously
  persistSessionToStorage();
}

async function persistSessionToStorage(): Promise<void> {
  try {
    const pairs: [string, string][] = [];
    if (currentAccessToken) pairs.push([STORAGE_KEY_ACCESS, currentAccessToken]);
    if (currentRefreshToken) pairs.push([STORAGE_KEY_REFRESH, currentRefreshToken]);
    if (currentUserId) pairs.push([STORAGE_KEY_USER_ID, currentUserId]);
    if (currentUser) pairs.push([STORAGE_KEY_USER, JSON.stringify(currentUser)]);
    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }
  } catch {
    // Storage failure non-blocking for in-memory session
  }
}

/**
 * Loads stored session from AsyncStorage on app startup.
 * Returns true if an active or refreshable session was restored.
 */
export async function loadSessionFromStorage(): Promise<boolean> {
  try {
    const items = await AsyncStorage.multiGet([
      STORAGE_KEY_ACCESS,
      STORAGE_KEY_REFRESH,
      STORAGE_KEY_USER_ID,
      STORAGE_KEY_USER,
    ]);

    const itemMap = new Map(items);
    const access = itemMap.get(STORAGE_KEY_ACCESS);
    const refresh = itemMap.get(STORAGE_KEY_REFRESH);
    const uid = itemMap.get(STORAGE_KEY_USER_ID);
    const userStr = itemMap.get(STORAGE_KEY_USER);

    if (access || refresh) {
      currentAccessToken = access || null;
      currentRefreshToken = refresh || null;
      currentUserId = uid || null;
      if (userStr) {
        try {
          currentUser = JSON.parse(userStr);
        } catch {
          currentUser = null;
        }
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns active JWT access token or empty string if unauthenticated.
 * NEVER returns a fake placeholder string.
 */
export function getSessionToken(): string {
  return currentAccessToken || '';
}

export function getRefreshToken(): string | null {
  return currentRefreshToken;
}

export function getSessionUserId(): string | null {
  return currentUserId;
}

export function getSessionUser(): UserSummary | null {
  return currentUser;
}

export function hasActiveSession(): boolean {
  return !!currentAccessToken;
}

export function clearSessionAuth(): void {
  currentAccessToken = null;
  currentRefreshToken = null;
  currentUserId = null;
  currentUser = null;

  AsyncStorage.multiRemove([
    STORAGE_KEY_ACCESS,
    STORAGE_KEY_REFRESH,
    STORAGE_KEY_USER_ID,
    STORAGE_KEY_USER,
  ]).catch(() => {});
}

/**
 * Attempts to exchange current refresh token for a new access token
 */
export async function refreshSessionTokens(): Promise<string | null> {
  if (!currentRefreshToken) {
    clearSessionAuth();
    notifyAuthExpired('Your session has expired. Please log in again.');
    return null;
  }

  try {
    const res = await apiRefreshTokens(currentRefreshToken);
    if (res.data?.tokens) {
      setSessionAuth(res.data.tokens, res.data.user.id, res.data.user);
      return res.data.tokens.accessToken;
    }
    clearSessionAuth();
    notifyAuthExpired('Unable to refresh session. Please log in again.');
    return null;
  } catch (error: any) {
    clearSessionAuth();
    const reason = error.message || 'Session expired. Please log in with OTP.';
    notifyAuthExpired(reason);
    return null;
  }
}

// Wire automatic token refresh to apiClient
registerTokenRefresher(refreshSessionTokens);

import { getApiBaseUrl } from './apiClient';
export const API_BASE = getApiBaseUrl();

export async function getAuthHeader(): Promise<Record<string, string>> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Synchronizes the current user session with MongoDB via /auth/me.
 * Ensures admin approvals, photo approvals, and status changes are immediately reflected.
 */
export async function syncCurrentUserWithBackend(): Promise<UserSummary | null> {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await apiGetCurrentUser(token);
    if (res.data?.user) {
      const updatedUser = res.data.user;
      currentUser = updatedUser;
      if (updatedUser.id) {
        currentUserId = updatedUser.id;
      }
      await persistSessionToStorage();
      notifyUserUpdated(updatedUser);
      return updatedUser;
    }
  } catch (err: any) {
    if (err?.code === 'TOKEN_EXPIRED' || err?.message?.includes('expired')) {
      const refreshedToken = await refreshSessionTokens();
      if (refreshedToken) {
        try {
          const retryRes = await apiGetCurrentUser(refreshedToken);
          if (retryRes.data?.user) {
            currentUser = retryRes.data.user;
            await persistSessionToStorage();
            notifyUserUpdated(currentUser);
            return currentUser;
          }
        } catch {
          // secondary error handled below
        }
      }
    }
    console.warn('[SessionSync] Unable to sync user profile:', err.message);
  }
  return currentUser;
}

