// File: src/lib/narration-guard.ts
// Narration is ADDITIVE 0G prose (no-fallback directive): the card renders fully from the real Qloo
// receipt regardless. The 0G narrate path currently truncates to a few words on some picks ("This
// digital gift", "As"). A fragment is NOT valid narration — showing it reads as broken, not honest.
// This guard renders narration ONLY when it is complete prose; otherwise the UI shows its existing
// honest "unavailable" / omitted state. It never fabricates — it only withholds a broken fragment.
export function completeNarration(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (t.length < 25) return null;                 // too short to be a real sentence
  if (!/[.!?]["')\]]?$/.test(t)) return null;     // not terminated → truncated mid-sentence
  if (t.split(/\s+/).length < 5) return null;     // fewer than ~5 words
  return t;
}
