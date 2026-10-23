import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSummary, AuthTokens } from '@bandhansetu/shared';
import {
  refreshTokens as apiRefreshTokens,
  getCurrentUser as apiGetCurrentUser,
  loginWithFirebase,
} from './authService';
import { registerTokenRefresher, getApiBaseUrl, ApiError } from './apiClient';
import { isFirebaseNativeAvailable } from './firebaseAuthService';

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

// In-flight refresh mutex to prevent duplicate concurrent refresh requests and race conditions
let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Attempts to re-authenticate with the backend via native Firebase Auth if available.
 * Obtains a fresh Firebase ID token using getIdToken(true) and exchanges it via /auth/firebase-login.
 */
async function tryRefreshViaFirebase(): Promise<AuthTokens | null> {
  if (!isFirebaseNativeAvailable()) {
    return null;
  }
  try {
    const authModule = require('@react-native-firebase/auth');
    const authInstance =
      typeof authModule.getAuth === 'function'
        ? authModule.getAuth()
        : typeof authModule === 'function'
        ? authModule()
        : authModule.default?.();

    const fbUser = authInstance?.currentUser;
    if (!fbUser) {
      return null;
    }

    const freshFirebaseIdToken = await fbUser.getIdToken(true);
    if (!freshFirebaseIdToken) {
      return null;
    }

    const loginRes = await loginWithFirebase(freshFirebaseIdToken);
    if (loginRes.data?.tokens) {
      return loginRes.data.tokens;
    }
  } catch {
    // Firebase refresh not possible or user not signed in via Firebase
  }
  return null;
}

/**
 * Executes token refresh logic:
 * 1. Primary: Exchanges backend refresh token with /auth/refresh
 * 2. Secondary: If backend refresh token is expired/invalid, attempts native Firebase re-authentication
 * 3. Fallback: Clears session and notifies app listeners that re-login is required.
 */
async function executeTokenRefresh(): Promise<string | null> {
  // 1. Primary: Try backend refresh token
  if (currentRefreshToken) {
    try {
      const res = await apiRefreshTokens(currentRefreshToken);
      if (res.data?.tokens) {
        setSessionAuth(
          res.data.tokens,
          res.data.user?.id || currentUserId,
          res.data.user || currentUser
        );
        return res.data.tokens.accessToken;
      }
    } catch (err: any) {
      const isNetworkError =
        err instanceof ApiError
          ? err.status === 0 || err.code === 'NETWORK_ERROR'
          : err?.message?.toLowerCase().includes('network') ||
            err?.message?.toLowerCase().includes('timeout') ||
            err?.message?.toLowerCase().includes('aborted');

      if (isNetworkError) {
        // Keep session for offline retry; do not log out on transient connectivity issues
        return null;
      }
      // If 400 or 401, refresh token is invalid or expired in DB. Proceed to secondary recovery.
    }
  }

  // 2. Secondary: If backend refresh token failed, try native Firebase recovery if logged in with Firebase
  try {
    const fbTokens = await tryRefreshViaFirebase();
    if (fbTokens) {
      setSessionAuth(fbTokens, currentUserId, currentUser);
      return fbTokens.accessToken;
    }
  } catch {
    // Secondary recovery failed
  }

  // 3. Complete Session Expiry: Clear tokens safely and notify navigation to redirect
  clearSessionAuth();
  notifyAuthExpired('Your session has expired. Please log in again.');
  return null;
}

/**
 * Thread-safe token refresher. Deduplicates multiple concurrent refresh requests
 * into a single in-flight Promise so tokens are never rotated multiple times simultaneously.
 */
export async function refreshSessionTokens(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      return await executeTokenRefresh();
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// Wire automatic token refresh to apiClient
registerTokenRefresher(refreshSessionTokens);

export const API_BASE = getApiBaseUrl();

export async function getAuthHeader(): Promise<Record<string, string>> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Synchronizes the current user session with MongoDB via /auth/me.
 * Transparently refreshes expired access tokens without duplicate calls or loops.
 */
export async function syncCurrentUserWithBackend(isRetry = false): Promise<UserSummary | null> {
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
    const isTokenExpired =
      err?.status === 401 &&
      (err?.code === 'TOKEN_EXPIRED' ||
        err?.code === 'INVALID_TOKEN' ||
        err?.message?.toLowerCase().includes('expired'));

    if (isTokenExpired && !isRetry) {
      // apiClient already attempts transparent refresh. If we reach here, attempt a single coordinated refresh
      const refreshedToken = await refreshSessionTokens();
      if (refreshedToken) {
        return syncCurrentUserWithBackend(true);
      }
      // If refresh returned null, session is dead and has been cleared
      return null;
    }

    // 403: Account suspended or rejected by admin
    if (err?.status === 403) {
      if (err?.details?.user) {
        currentUser = err.details.user;
        await persistSessionToStorage();
        notifyUserUpdated(currentUser!);
      }
      return currentUser;
    }

    // Network / timeout errors: return last cached user without clearing session
    const isNetworkError =
      err?.status === 0 ||
      err?.code === 'NETWORK_ERROR' ||
      err?.message?.toLowerCase().includes('network') ||
      err?.message?.toLowerCase().includes('timeout');

    if (isNetworkError) {
      return currentUser;
    }
  }
  return currentUser;
}

