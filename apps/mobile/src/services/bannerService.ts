import { apiClient } from './apiClient';
import { HomeBanner } from '@bandhansetu/shared';

/** Active admin banners for the Home hero. Never throws: no banners => built-in artwork. */
export async function getActiveBanners(): Promise<HomeBanner[]> {
  try {
    const res = await apiClient<{ success: boolean; data?: { items?: HomeBanner[] } }>('/banners', { method: 'GET' });
    const items = res?.data?.items;
    return Array.isArray(items) ? items.filter((b) => !!b && typeof b.imageUrl === 'string' && b.imageUrl) : [];
  } catch {
    return [];
  }
}
