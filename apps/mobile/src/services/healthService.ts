import { apiClient } from './apiClient';
import { ApiResponse, HealthCheckResponse } from '@bandhansetu/shared';

export interface HealthCheckResult {
  isHealthy: boolean;
  message: string;
  data?: HealthCheckResponse;
  timestamp: string;
  error?: string;
  latencyMs: number;
}

/**
 * Service function to ping the backend health endpoint
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await apiClient<ApiResponse<HealthCheckResponse>>('/health', {
      method: 'GET',
      timeoutMs: 5000,
    });
    const latencyMs = Date.now() - startTime;

    return {
      isHealthy: response.success && response.data?.status === 'ok',
      message: response.message || 'Backend is reachable',
      data: response.data,
      timestamp: new Date().toLocaleTimeString(),
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      isHealthy: false,
      message: err.message || 'Failed to connect to backend',
      error: err.code || 'CONNECTION_ERROR',
      timestamp: new Date().toLocaleTimeString(),
      latencyMs,
    };
  }
}
