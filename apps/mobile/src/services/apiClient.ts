import { Platform, NativeModules } from 'react-native';

/**
 * BandhanSetu Centralized API Client
 * 
 * Rules:
 * 1. Screens must never call `fetch` or Axios directly.
 * 2. Reads `EXPO_PUBLIC_API_URL` with robust fallbacks:
 *    - Dynamically detects Metro host machine IP on local Wi-Fi.
 *    - Android emulator requires 10.0.2.2 to access host machine localhost.
 *    - Web/iOS can use localhost.
 * 3. Enforces timeout, content-type headers, and structured error handling.
 */

const getHostFromRuntime = (): string | null => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {}

  try {
    const Constants = require('expo-constants').default;
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch {}

  return null;
};

// Determine optimal default base URL based on platform and dynamic Metro host
const resolveBaseUrl = (): string => {
  const runtimeHost = getHostFromRuntime();

  if (process.env.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    // If runtime host IP from Metro is detected and differs from a stale 192.168.x.x IP in .env, adapt dynamically
    if (runtimeHost && envUrl.includes('192.168.') && !envUrl.includes(runtimeHost)) {
      return envUrl.replace(/https?:\/\/[^:/]+/, `http://${runtimeHost}`);
    }
    return envUrl;
  }

  if (runtimeHost) {
    return `http://${runtimeHost}:5000/api/v1`;
  }

  if (Platform.OS === 'android') {
    return 'http://192.168.1.13:5000/api/v1';
  }

  return 'http://192.168.1.13:5000/api/v1';
};

const BASE_URL = resolveBaseUrl();

export interface ApiClientOptions extends RequestInit {
  timeoutMs?: number;
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status = 0, code = 'NETWORK_ERROR', details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const getApiBaseUrl = (): string => BASE_URL;

let tokenRefresher: (() => Promise<string | null>) | null = null;

export function registerTokenRefresher(refresher: () => Promise<string | null>): void {
  tokenRefresher = refresher;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions & { _isRetry?: boolean } = {}
): Promise<T> {
  const { timeoutMs = 45000, headers, _isRetry, ...restOptions } = options;

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...restOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMessage =
        (typeof data === 'object' && data?.message) ||
        `HTTP Error ${response.status}: ${response.statusText}`;
      const errorCode = (typeof data === 'object' && data?.error?.code) || 'API_ERROR';

      const isUnauthenticatedAuthRoute =
        cleanEndpoint.includes('/auth/refresh') ||
        cleanEndpoint.includes('/auth/firebase-login') ||
        cleanEndpoint.includes('/auth/request-otp') ||
        cleanEndpoint.includes('/auth/verify-otp') ||
        cleanEndpoint.includes('/auth/register');

      const isTokenExpired =
        response.status === 401 &&
        (errorCode === 'TOKEN_EXPIRED' ||
          errorCode === 'INVALID_TOKEN' ||
          (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('expired')));

      // Transparent token refresh and single retry on 401 TOKEN_EXPIRED
      if (
        isTokenExpired &&
        !_isRetry &&
        !isUnauthenticatedAuthRoute &&
        tokenRefresher
      ) {
        const refreshedToken = await tokenRefresher();
        if (refreshedToken) {
          const updatedHeaders: Record<string, string> = { ...(headers as any) };
          delete updatedHeaders['authorization'];
          delete updatedHeaders['Authorization'];
          updatedHeaders['Authorization'] = `Bearer ${refreshedToken}`;

          return apiClient<T>(endpoint, {
            ...options,
            _isRetry: true,
            headers: updatedHeaders,
          });
        }
      }

      throw new ApiError(errorMessage, response.status, errorCode, data?.error?.details);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    const isAborted =
      controller.signal.aborted ||
      err.name === 'AbortError' ||
      (typeof err.message === 'string' &&
        (err.message.toLowerCase().includes('canceled') ||
          err.message.toLowerCase().includes('cancelled') ||
          err.message.toLowerCase().includes('abort')));

    if (isAborted) {
      const isRender = BASE_URL.includes('onrender.com');
      const timeoutMessage = isRender
        ? `Request timed out (${Math.round(timeoutMs / 1000)}s). Render backend is waking up from sleep (cold start). Please wait a few seconds and try again.`
        : `Request to ${cleanEndpoint} timed out after ${timeoutMs}ms. Please check your network connection.`;

      throw new ApiError(timeoutMessage, 408, 'TIMEOUT_ERROR');
    }

    const isLocalUrl =
      BASE_URL.includes('192.168.') ||
      BASE_URL.includes('10.0.2.2') ||
      BASE_URL.includes('localhost') ||
      BASE_URL.includes('127.0.0.1');

    const networkHint = isLocalUrl
      ? ' Ensure PC and phone are on the same Wi-Fi and PC IP has not changed.'
      : ' Please check your mobile internet or backend server status.';

    throw new ApiError(
      `Unable to connect to backend server at ${BASE_URL}.${networkHint} (${err.message || 'Network request failed'})`,
      0,
      'CONNECTION_FAILED'
    );
  }
}
