import { apiClient } from './apiClient';
import {
  ApiResponse,
  PartnerPreferencesInput,
  PartnerPreferences,
} from '@bandhansetu/shared';

/**
 * Mobile Partner Preferences Service
 * Communicates with backend endpoints under /api/v1/preferences
 */

export async function getMyPreferences(
  accessToken: string
): Promise<ApiResponse<PartnerPreferences>> {
  return apiClient<ApiResponse<PartnerPreferences>>('/preferences/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function upsertMyPreferences(
  accessToken: string,
  input: PartnerPreferencesInput
): Promise<ApiResponse<PartnerPreferences>> {
  return apiClient<ApiResponse<PartnerPreferences>>('/preferences/me', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}
