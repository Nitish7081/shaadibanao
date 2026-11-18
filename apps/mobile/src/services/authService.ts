import { apiClient } from './apiClient';
import {
  AccountDeletionReason,
  AccountDeletionResponse,
  ApiResponse,
  AuthResponse,
  RecordConsentInput,
  RegisterInput,
  RequestOtpResponse,
  UserSummary,
  VerifyOtpResponse,
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

export async function loginWithFirebase(
  idToken: string,
  profileFor?: string,
  consentOptions?: {
    consentToTerms?: boolean;
    privacyPolicyVersion?: string;
    termsVersion?: string;
  }
): Promise<ApiResponse<AuthResponse>> {
  return apiClient<ApiResponse<AuthResponse>>('/auth/firebase-login', {
    method: 'POST',
    body: JSON.stringify({
      idToken,
      profileFor,
      ...(consentOptions || {}),
    }),
  });
}

export async function recordPolicyConsent(
  accessToken: string,
  input: RecordConsentInput
): Promise<ApiResponse<{ user: UserSummary }>> {
  return apiClient<ApiResponse<{ user: UserSummary }>>('/auth/consent', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}

export async function deleteMyAccount(
  accessToken: string,
  reason: AccountDeletionReason = 'other',
  additionalFeedback?: string
): Promise<ApiResponse<AccountDeletionResponse>> {
  return apiClient<ApiResponse<AccountDeletionResponse>>('/public/account-deletion', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      reason,
      additionalFeedback,
      confirmPermanentDeletion: true,
    }),
  });
}


export async function getCurrentUser(
  accessToken?: string
): Promise<ApiResponse<{ user: UserSummary }>> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return apiClient<ApiResponse<{ user: UserSummary }>>('/auth/me', {
    method: 'GET',
    headers,
  });
}

export async function refreshTokens(
  refreshToken: string
): Promise<ApiResponse<AuthResponse>> {
  return apiClient<ApiResponse<AuthResponse>>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
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
