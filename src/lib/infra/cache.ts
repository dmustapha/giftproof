// File: src/lib/infra/cache.ts
import { LRUCache } from "lru-cache";
// Keyed on the NORMALIZED signal set so swap/retry hit cache, not quota.
// DEV-005: lru-cache v11 constrains the value generic to `V extends {}`, so ARCHITECTURE's
// `<string, unknown>` does not typecheck. `NonNullable<unknown>` is the lint-clean spelling of the
// library's own non-null value constraint; cache semantics are identical (we only store objects),
// and callers still see `T` via the casts.
type CacheVal = NonNullable<unknown>;
const cache = new LRUCache<string, CacheVal>({ max: 500, ttl: 1000 * 60 * 30 }); // 30 min
export function cacheKey(parts: Record<string, unknown>): string {
  // Stable key: sort keys, sort array values, lowercase — so {a,b} === {b,a}.
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? [...v].map(norm).sort() :
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).sort().map(([k, x]) => [k, norm(x)])) :
    typeof v === "string" ? v.toLowerCase() : v;
  return JSON.stringify(norm(parts));
}
// A second, NON-expiring map of last-good values (capped), so a 429 can serve a stale result
// instead of a blank grid. cacheSet writes BOTH maps; cacheGet honors the TTL; cacheGetStale
// ignores the TTL and returns the last-good value even past expiry (labeled stale by the caller).
const staleCache = new Map<string, unknown>();
const STALE_MAX = 500;
export function cacheGet<T>(key: string): T | undefined { return cache.get(key) as T | undefined; }
export function cacheSet<T>(key: string, val: T): void {
  cache.set(key, val as CacheVal);   // DEV-005: v11 value generic is non-null; we only cache objects
  if (staleCache.size >= STALE_MAX && !staleCache.has(key)) {
    const oldest = staleCache.keys().next().value;       // simple FIFO cap (insertion order)
    if (oldest !== undefined) staleCache.delete(oldest);
  }
  staleCache.set(key, val);
}
// Returns a last-good value even past TTL (survives LRU eviction + expiry). Used as the 429
// fallback so QLOO_UNREACHABLE can serve a labeled stale pick set instead of a blank grid.
export function cacheGetStale<T>(key: string): T | undefined { return staleCache.get(key) as T | undefined; }
