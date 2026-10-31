// File: src/lib/qloo/resolve.ts
// VERIFIED at wire (2026-10-29, DEV-010): /search returns { results: [{ entity_id, name, types }] };
// /v2/tags returns { success, results: { tags: [{ id, name, ... }] } } — the tag array is NESTED
// under results.tags (the earlier top-level `tags` guess was WRONG and silently dropped every tag
// signal, which is why generic concept tastes like "jazz"/"woodworking" resolved to nothing).
import { qlooGet } from "./client";
import { stripPII } from "./validate";
import type { CandidateTaste, QlooSignal, Coverage } from "@/lib/types";

interface SearchResp { results?: Array<{ entity_id?: string; id?: string; name?: string; types?: string[] }> }
interface TagsResp { results?: { tags?: Array<{ id?: string; name?: string; value?: string }> }; tags?: Array<{ id?: string; name?: string; value?: string }> }

async function searchEntity(name: string): Promise<QlooSignal | null> {
  const resp = await qlooGet<SearchResp>("/search", { query: name });
  const hit = resp.results?.[0];
  const id = hit?.entity_id ?? hit?.id;
  if (!id) return null;
  return { kind: "entity", value: id, label: hit?.name ?? name, source: "search" };
}

async function searchTag(name: string): Promise<QlooSignal | null> {
  const resp = await qlooGet<TagsResp>("/v2/tags", { "filter.query": name });
  const hit = resp.results?.tags?.[0] ?? resp.tags?.[0];
  const urn = hit?.id ?? hit?.value;
  if (!urn) return null;
  return { kind: "tag", value: urn, label: hit?.name ?? name, source: "tags" };
}

// Exported tag resolver for the DEPTH-PASS B refine loop (orchestrate.ts): the agent adds a Qloo tag
// to sharpen a broad query. Same /v2/tags path + semaphore/cache as resolution — returns null if
// nothing resolves (the loop then records "no sharper tag", never fabricates one).
export function searchTagSignal(name: string): Promise<QlooSignal | null> {
  return searchTag(name);
}

// Resolve each taste to an entity; fall back to a tag; report coverage honestly.
// E-2 latency gate: candidates resolve CONCURRENTLY (the Semaphore(2) in client.ts still bounds
// real in-flight Qloo calls to 2, so this respects the 5 req/s limit while cutting wall-clock from
// N sequential round-trips to ~ceil(N/2)). Order is preserved via the indexed results array.
export async function resolveSignals(cands: CandidateTaste[]): Promise<{ signals: QlooSignal[]; coverage: Coverage }> {
  const resolved = await Promise.all(
    cands.map(async (c): Promise<{ sig: QlooSignal | null; miss: string }> => {
      const safe = stripPII(c.name);
      if (!safe) return { sig: null, miss: c.name };     // PII_BLOCKED (NN-2)
      const sig = (await searchEntity(safe)) ?? (await searchTag(safe));
      return { sig, miss: safe };
    }),
  );
  const signals: QlooSignal[] = [];
  const misses: string[] = [];
  for (const r of resolved) {
    if (r.sig) signals.push(r.sig); else misses.push(r.miss);
  }
  return { signals, coverage: { resolved: signals.length, total: cands.length, misses } };
}
