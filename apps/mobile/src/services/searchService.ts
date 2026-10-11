import { apiClient } from './apiClient';
import {
  ApiResponse,
  SearchFilterInput,
  SearchResultProfile,
  PaginatedResponse,
} from '@bandhansetu/shared';

/**
 * Mobile Search Service
 * Calls /api/v1/search with compound filters & pagination
 */
export async function searchProfiles(
  accessToken: string,
  filters: Partial<SearchFilterInput> = {}
): Promise<ApiResponse<PaginatedResponse<SearchResultProfile>>> {
  const queryParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  const queryStr = queryParams.toString();
  const endpoint = queryStr ? `/search?${queryStr}` : '/search';

  return apiClient<ApiResponse<PaginatedResponse<SearchResultProfile>>>(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
