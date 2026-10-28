import { apiClient } from './apiClient';
import { HomeBanner } from '@bandhansetu/shared';

let cachedBanners: HomeBanner[] | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds short-lived cache

/** Active admin banners for the Home hero. Short cache keeps it fresh without app rebuild. */
export async function getActiveBanners(forceRefresh = false): Promise<HomeBanner[]> {
  const now = Date.now();
  if (!forceRefresh && cachedBanners && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedBanners;
  }
  try {
    const res = await apiClient<{ success: boolean; data?: { items?: HomeBanner[] } }>('/banners', { method: 'GET' });
    const items = res?.data?.items;
    const valid = Array.isArray(items) ? items.filter((b) => !!b && typeof b.imageUrl === 'string' && b.imageUrl) : [];
    cachedBanners = valid;
    lastFetchedAt = now;
    return valid;
  } catch {
    return cachedBanners || [];
  }
}
