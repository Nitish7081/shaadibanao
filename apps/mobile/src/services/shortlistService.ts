import { apiClient } from './apiClient';
import { ApiResponse, ShortlistItem } from '@bandhansetu/shared';

/**
 * Mobile Shortlist Service
 * Centralized service for shortlist operations
 */

export async function getShortlists(
  accessToken: string
): Promise<ApiResponse<ShortlistItem[]>> {
  return apiClient<ApiResponse<ShortlistItem[]>>('/shortlists', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function addShortlist(
  accessToken: string,
  profileId: string
): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>(`/shortlists/${profileId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function removeShortlist(
  accessToken: string,
  profileId: string
): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>(`/shortlists/${profileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
