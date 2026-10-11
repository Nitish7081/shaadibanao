import { apiClient } from './apiClient';
import {
  ApiResponse,
  RequestOtpResponse,
  VerifyOtpResponse,
  AuthResponse,
  RegisterInput,
  UserSummary,
} from '@bandhansetu/shared';

/**
 * Mobile Authentication Service
 * Calls backend endpoints under /api/v1/auth
 */

export async function requestOtp(mobile: string): Promise<ApiResponse<RequestOtpResponse>> {
  return apiClient<ApiResponse<RequestOtpResponse>>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });
}

export async function verifyOtp(
  mobile: string,
  otp: string
): Promise<ApiResponse<VerifyOtpResponse>> {
  return apiClient<ApiResponse<VerifyOtpResponse>>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile, otp }),
  });
}

export async function registerUser(input: RegisterInput): Promise<ApiResponse<AuthResponse>> {
  return apiClient<ApiResponse<AuthResponse>>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(
  accessToken: string
): Promise<ApiResponse<{ user: UserSummary }>> {
  return apiClient<ApiResponse<{ user: UserSummary }>>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function logoutUser(
  accessToken: string,
  refreshToken?: string
): Promise<ApiResponse> {
  return apiClient<ApiResponse>('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refreshToken }),
  });
}
