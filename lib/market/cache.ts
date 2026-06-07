interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Tiny in-memory TTL cache with in-flight de-duplication (concurrent callers for
 * the same key share one fetch — avoids stampeding Yahoo when a list of cards
 * mounts at once). MMKV-backed persistence for a "stale on cold start" snapshot
 * is deferred — see issue #2.
 */
export class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Return the cached value, or compute it once and cache it for `ttlMs`. */
  async remember<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const pending = fn()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, pending);
    return pending;
  }
}
