// File: src/lib/qloo/client.ts
import { qlooSemaphore } from "@/lib/infra/semaphore";
import { cacheKey, cacheGet, cacheGetStale, cacheSet } from "@/lib/infra/cache";
import { TOKENS } from "@/lib/types";

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY ?? "";   // BACKEND ONLY — never bundled (INVARIANTS NN-6)

// Single gateway: cache → semaphore → fetch. Header X-Api-Key, GET query string.
export async function qlooGet<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!KEY) throw new Error(`${TOKENS.QLOO_UNREACHABLE}: QLOO_API_KEY missing`);
  const key = cacheKey({ path, params });
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}?${qs}`;
  // On a 429 / non-ok, before throwing QLOO_UNREACHABLE, serve a last-good STALE value for this
  // exact key if one exists (labeled stale by the orchestrator) — a stale real pick set beats a
  // blank grid, and it is still genuine Qloo output, never a fabrication (NN-3). Only when there
  // is no stale value do we throw and let the orchestrator degrade to the labeled token.
  const data = await qlooSemaphore.run(async (): Promise<T> => {
    const r = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
    if (r.status === 429) {
      const stale = cacheGetStale<T>(key);
      if (stale !== undefined) return stale;
      throw new Error(`${TOKENS.QLOO_UNREACHABLE}: 429 quota`);
    }
    if (!r.ok) {
      const stale = cacheGetStale<T>(key);
      if (stale !== undefined) return stale;
      throw new Error(`${TOKENS.QLOO_UNREACHABLE}: HTTP ${r.status}`);
    }
    return (await r.json()) as T;
  });
  cacheSet(key, data);
  return data;
}

// Keyless liveness (for /api/health): proves the HOST is up, NOT that the key works — a revoked
// or wrong-tenant key returns the same 401 as a healthy gated endpoint.
export async function qlooReachable(): Promise<boolean> {
  try {
    // Bounded wait: a SLOW (not dead) Qloo host must not hang /api/health indefinitely. (debug P6 M2)
    const r = await fetch(`${BASE}/v2/insights`, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    return r.status === 401 || r.status === 200; // 401 = alive+gated
  } catch { return false; }
}

// Authenticated reachability (for /api/health?deep=1): a tiny KEYED /v2/insights call (take=1) that
// actually detects a revoked / wrong-tenant / quota-exhausted key — the keyless HEAD cannot. Rate-
// limited to once per keep-warm interval so it never burns quota on every poll; the keep-warm cron
// is the intended caller and logs failures. A 2xx => key good; anything else (incl. 401/429) => bad.
let lastKeyedCheck = 0;
const KEYED_CHECK_INTERVAL_MS = 1000 * 60 * 5; // match the keep-warm cron cadence
let lastKeyedResult = false;
export async function qlooKeyedReachable(): Promise<boolean> {
  const now = Date.now();
  if (now - lastKeyedCheck < KEYED_CHECK_INTERVAL_MS) return lastKeyedResult; // rate-limited
  lastKeyedCheck = now;
  if (!KEY) { lastKeyedResult = false; return false; }
  try {
    const r = await fetch(`${BASE}/v2/insights?filter.type=urn:entity:brand&take=1`, {
      headers: { "X-Api-Key": KEY, Accept: "application/json" },
      signal: AbortSignal.timeout(4000), // bounded wait — a slow host must not hang keep-warm (debug P6 M2)
    });
    lastKeyedResult = r.ok;
    return lastKeyedResult;
  } catch { lastKeyedResult = false; return false; }
}
