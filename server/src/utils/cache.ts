/**
 * Bounded O(1) LRU + TTL Cache for safe, short-lived read caching
 * Never used to bypass payment, commission, booking conflict, or permission checks.
 */
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class BoundedTTLCache<V = any> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries = 200, defaultTtlMs = 15_000) {
    this.maxEntries = Math.max(10, maxEntries);
    this.defaultTtlMs = Math.max(500, defaultTtlMs);
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency in O(1) via Map insertion order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const readCache = new BoundedTTLCache(250, 15_000);
