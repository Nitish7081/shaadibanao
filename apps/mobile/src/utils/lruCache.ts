/**
 * DSA Component: High-Performance LRU (Least Recently Used) Cache with TTL
 * Architecture:
 *  - Hash Map (Map<K, Node<K, V>>) for O(1) key-to-node lookup.
 *  - Doubly Linked List with head & tail pointers for O(1) node relocation and eviction.
 *  - Time-To-Live (TTL) expiration support to prevent stale matrimonial records.
 *  - Two-tier cache architecture: L1 RAM (sub-millisecond) + L2 Persistent Storage (AsyncStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  expiresAt: number | null;
}

export class LRUCache<K extends string | number, V> {
  private readonly capacity: number;
  private readonly map: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null = null; // Most recently used
  private tail: CacheNode<K, V> | null = null; // Least recently used

  constructor(capacity = 100) {
    if (capacity <= 0) {
      throw new Error('LRUCache capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.map = new Map<K, CacheNode<K, V>>();
  }

  /**
   * Retrieves a value in O(1) time complexity.
   * If found and not expired, moves the node to the head (most recently used).
   */
  public get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      return undefined;
    }

    // Check TTL expiration
    if (node.expiresAt !== null && Date.now() > node.expiresAt) {
      this.removeNode(node);
      this.map.delete(key);
      return undefined;
    }

    this.moveToHead(node);
    return node.value;
  }

  /**
   * Inserts or updates a value in O(1) time complexity.
   * If capacity is exceeded, evicts the least recently used node from the tail in O(1).
   */
  public set(key: K, value: V, ttlMs?: number): void {
    const expiresAt = typeof ttlMs === 'number' && ttlMs > 0 ? Date.now() + ttlMs : null;
    const existingNode = this.map.get(key);

    if (existingNode) {
      existingNode.value = value;
      existingNode.expiresAt = expiresAt;
      this.moveToHead(existingNode);
      return;
    }

    const newNode: CacheNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
      expiresAt,
    };

    if (this.map.size >= this.capacity) {
      // Evict LRU element
      if (this.tail) {
        const evictedKey = this.tail.key;
        this.removeNode(this.tail);
        this.map.delete(evictedKey);
      }
    }

    this.addToHead(newNode);
    this.map.set(key, newNode);
  }

  /**
   * Deletes a key in O(1) time complexity.
   */
  public delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  /**
   * Checks if key exists and is unexpired in O(1).
   */
  public has(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (node.expiresAt !== null && Date.now() > node.expiresAt) {
      this.removeNode(node);
      this.map.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clears the entire cache.
   */
  public clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  public get size(): number {
    return this.map.size;
  }

  // --- Linked List Operations (All O(1)) ---

  private addToHead(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  private moveToHead(node: CacheNode<K, V>): void {
    if (this.head === node) return;
    this.removeNode(node);
    this.addToHead(node);
  }
}

/**
 * FastAppCache: Two-Tier Cache System (L1 In-Memory LRU + L2 AsyncStorage)
 * Implements Stale-While-Revalidate (SWR) for lightning fast app boot & instant responsiveness.
 */
class FastAppCacheService {
  private l1Cache = new LRUCache<string, any>(150);
  private storagePrefix = '@shaadibanao_fast_cache:';

  /**
   * O(1) synchronous read from L1 Memory Cache.
   */
  public getMemory<T>(key: string): T | undefined {
    return this.l1Cache.get(key) as T | undefined;
  }

  /**
   * Asynchronous read with fallback to L2 Persistent Storage.
   */
  public async get<T>(key: string): Promise<T | undefined> {
    // 1. Try L1 RAM Cache (Instant, O(1))
    const memoryVal = this.l1Cache.get(key);
    if (memoryVal !== undefined) {
      return memoryVal as T;
    }

    // 2. Try L2 Disk Storage (AsyncStorage)
    try {
      const stored = await AsyncStorage.getItem(this.storagePrefix + key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          AsyncStorage.removeItem(this.storagePrefix + key).catch(() => {});
          return undefined;
        }
        // Promote back to L1 RAM
        this.l1Cache.set(key, parsed.data, parsed.expiresAt ? parsed.expiresAt - Date.now() : undefined);
        return parsed.data as T;
      }
    } catch {
      // Storage read fail silent
    }

    return undefined;
  }

  /**
   * Write to L1 Memory Cache and optionally persist to L2 Disk Storage.
   */
  public async set<T>(key: string, value: T, ttlMs?: number, persistToDisk = true): Promise<void> {
    this.l1Cache.set(key, value, ttlMs);

    if (persistToDisk) {
      try {
        const payload = JSON.stringify({
          data: value,
          expiresAt: typeof ttlMs === 'number' && ttlMs > 0 ? Date.now() + ttlMs : null,
          savedAt: Date.now(),
        });
        await AsyncStorage.setItem(this.storagePrefix + key, payload);
      } catch {
        // Disk write best effort
      }
    }
  }

  /**
   * Invalidate cache entry across both tiers.
   */
  public async invalidate(key: string): Promise<void> {
    this.l1Cache.delete(key);
    try {
      await AsyncStorage.removeItem(this.storagePrefix + key);
    } catch {}
  }

  /**
   * Stale-While-Revalidate (SWR): Returns cached data instantly in < 1ms,
   * while asynchronously executing the fetcher to update the cache in the background.
   */
  public async swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = 10 * 60 * 1000 // 10 minutes default TTL
  ): Promise<{ data: T; isFromCache: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      // Fire background revalidation non-blockingly
      fetcher()
        .then((fresh) => {
          if (fresh !== undefined && fresh !== null) {
            this.set(key, fresh, ttlMs);
          }
        })
        .catch(() => {});

      return { data: cached, isFromCache: true };
    }

    // If not in cache, await fetcher and populate
    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) {
      await this.set(key, fresh, ttlMs);
    }
    return { data: fresh, isFromCache: false };
  }

  /**
   * Purge all cache
   */
  public async clearAll(): Promise<void> {
    this.l1Cache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(this.storagePrefix));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch {}
  }
}

export const FastAppCache = new FastAppCacheService();
