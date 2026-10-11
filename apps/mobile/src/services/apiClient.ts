import { Platform } from 'react-native';

/**
 * BandhanSetu Centralized API Client
 * 
 * Rules:
 * 1. Screens must never call `fetch` or Axios directly.
 * 2. Reads `EXPO_PUBLIC_API_URL` with robust fallbacks:
 *    - Android emulator requires 10.0.2.2 to access host machine localhost.
 *    - Web/iOS can use localhost.
 * 3. Enforces timeout, content-type headers, and structured error handling.
 */

// Determine optimal default base URL based on platform
const getDefaultBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    // 10.0.2.2 is the standard loopback IP for Android emulator to reach host PC
    return 'http://10.0.2.2:5000/api/v1';
  }
  return 'http://localhost:5000/api/v1';
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultBaseUrl();

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

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { timeoutMs = 8000, headers, ...restOptions } = options;

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
      throw new ApiError(errorMessage, response.status, errorCode, data?.error?.details);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new ApiError(
        `Request to ${cleanEndpoint} timed out after ${timeoutMs}ms. Please verify backend server is running at ${BASE_URL}.`,
        408,
        'TIMEOUT_ERROR'
      );
    }

    throw new ApiError(
      `Unable to connect to backend server at ${BASE_URL}. ${err.message || 'Check your network connection or server port.'}`,
      0,
      'CONNECTION_FAILED'
    );
  }
}
