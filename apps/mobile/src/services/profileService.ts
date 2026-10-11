import { apiClient } from './apiClient';
import {
  ApiResponse,
  UpsertProfileInput,
  UserProfile,
  PublicProfile,
} from '@bandhansetu/shared';

/**
 * Mobile Profile Service
 * Communicates with backend endpoints under /api/v1/profiles
 */

export async function getMyProfile(accessToken: string): Promise<ApiResponse<UserProfile>> {
  return apiClient<ApiResponse<UserProfile>>('/profiles/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function upsertMyProfile(
  accessToken: string,
  input: UpsertProfileInput
): Promise<ApiResponse<UserProfile>> {
  return apiClient<ApiResponse<UserProfile>>('/profiles/me', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}

export async function getPublicProfile(
  accessToken: string,
  profileId: string
): Promise<ApiResponse<PublicProfile>> {
  return apiClient<ApiResponse<PublicProfile>>(`/profiles/${profileId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
