import { apiClient } from './apiClient';
import { ApiResponse, InterestItem } from '@bandhansetu/shared';

/**
 * Mobile Interest Service
 * Centralized service for sending, listing, responding to, and withdrawing interests
 */

export async function sendInterest(
  accessToken: string,
  profileId: string
): Promise<ApiResponse<InterestItem>> {
  return apiClient<ApiResponse<InterestItem>>(`/interests/${profileId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getReceivedInterests(
  accessToken: string
): Promise<ApiResponse<InterestItem[]>> {
  return apiClient<ApiResponse<InterestItem[]>>('/interests/received', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getSentInterests(
  accessToken: string
): Promise<ApiResponse<InterestItem[]>> {
  return apiClient<ApiResponse<InterestItem[]>>('/interests/sent', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function updateInterestStatus(
  accessToken: string,
  interestId: string,
  status: 'accepted' | 'declined'
): Promise<ApiResponse<InterestItem>> {
  return apiClient<ApiResponse<InterestItem>>(`/interests/${interestId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status }),
  });
}

export async function withdrawInterest(
  accessToken: string,
  interestId: string
): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>(`/interests/${interestId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
