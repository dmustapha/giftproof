// File: src/components/SeedChips.tsx
"use client";
import { useState } from "react";
import type { Seed } from "@/lib/types";

// Renders the resolved tastes as removable chips plus an add-taste input. Every change calls
// onChange(newSeeds); the PARENT debounces (350ms) before hitting /api/swap (the live-recompute hero).
export function SeedChips({ seeds, onChange }: { seeds: Seed[]; onChange: (seeds: Seed[]) => void }) {
  const [draft, setDraft] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  function remove(id: string) {
    onChange(seeds.filter((s) => s.id !== id));
  }

  // A manually added taste must be SERVER-RESOLVED, never fabricated from label.toLowerCase().
  // We call /api/resolve (the same resolveSignals path /api/gift uses) and only add the chip once a
  // REAL entity/tag resolves. If it resolves to nothing, show "couldn't resolve that taste" and add
  // no chip, the client never invents a tag URN it cannot prove Qloo knows.
  async function add() {
    const label = draft.trim();
    if (!label || resolving) return;
    setResolving(true);
    setResolveError(null);
    try {
      const r = await fetch("/api/resolve", { method: "POST", body: JSON.stringify({ name: label }) });
      const j = (await r.json()) as { seed?: Seed | null; error?: string };
      if (j.seed) {
        onChange([...seeds, j.seed]);
        setDraft("");
      } else {
        setResolveError("couldn't resolve that taste");
      }
    } catch {
      setResolveError("couldn't resolve that taste");
    } finally {
      setResolving(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
        Seed tastes · swap one to re-print the receipts
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {seeds.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--ink-12)] bg-paper-2 px-2.5 py-1 text-[13px] text-ink"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">§ {s.signal.source}</span>
            {s.label}
            <button
              type="button"
              aria-label={`Remove ${s.label}`}
              onClick={() => remove(s.id)}
              className="rounded-[4px] px-1 font-mono text-ink-3 transition-colors hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-20)]"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setResolveError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          disabled={resolving}
          placeholder={resolving ? "resolving…" : "+ add a taste"}
          className="min-w-32 flex-1 rounded-[6px] border border-dashed border-[var(--ink-12)] bg-transparent px-3 py-1 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-3 focus-visible:border-accent disabled:opacity-50"
        />
      </div>
      {resolveError && <p role="status" className="font-mono text-[10px] text-[var(--color-band-medium)]">{resolveError}</p>}
    </section>
  );
}
