import { apiClient } from './apiClient';
import { ApiResponse } from '@bandhansetu/shared';

export interface KundliData {
  userId?: string;
  dateOfBirth: string;
  timeOfBirth: string;
  isApproximateTime?: boolean;
  birthPlace: {
    name: string;
    state?: string;
    country?: string;
  };
  rashi: string;
  nakshatra: string;
  charan?: number;
  lagna?: string;
  manglikStatus?: 'non_manglik' | 'manglik' | 'anshik_manglik' | 'dont_know';
  visibility?: 'private' | 'matches_only' | 'shared_with_pandit';
  chartUrl?: string;
  notes?: string;
}

export async function getMyKundli(accessToken: string): Promise<ApiResponse<KundliData | null>> {
  return apiClient<ApiResponse<KundliData | null>>('/astrology/kundli/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function upsertMyKundli(
  accessToken: string,
  input: Partial<KundliData>
): Promise<ApiResponse<KundliData>> {
  return apiClient<ApiResponse<KundliData>>('/astrology/kundli/me', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}
