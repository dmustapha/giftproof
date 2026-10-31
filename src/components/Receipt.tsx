// File: src/components/Receipt.tsx
// THE SIGNATURE OBJECT (SIGNATURE-SPEC.md) — a printed taste receipt, not a chart/gauge/bar.
// Three printed zones: header (band-chip) · the drawn cross-domain bridge · the cite-ribbon
// ("QLOO SAYS / WE CHOSE"). Every figure traces to a real types.ts field (NN-3). On a seed swap the
// parent changes this component's React key, remounting it so the slip RE-PRINTS and the bridge
// RE-DRAWS (the on-air "oh"). Reduced-motion collapses the tweens (globals.css), the content is identical.
import type { Provenance, QlooPick } from "@/lib/types";
import { Bridge } from "./Bridge";

export function Receipt({
  pick,
  provenance,
  animate = true,
  bare = false,
}: {
  pick: QlooPick;
  provenance: Provenance;
  animate?: boolean;
  bare?: boolean; // drop own border/bg when framed inside another object (e.g. the hero monument)
}) {
  const { qlooSays, weChose } = provenance;
  const exact = weChose.matchType === "exact";
  // the cite-ribbon carries a band-colored top rule (R4 cite-ribbon spec) — the ONE place the
  // affinity band hue appears on the receipt, tying the proof line to the rank strength.
  const bandHue =
    pick.rankBand === "high" ? "var(--color-band-high)"
    : pick.rankBand === "medium" ? "var(--color-band-medium)"
    : "var(--color-band-low)";

  return (
    <div
      className={`relative overflow-hidden ${bare ? "" : "rounded-[7px] border border-[var(--hair)] bg-paper-2"} ${animate ? "slip-reprint" : ""}`}
    >
      {/* torn/perforated top edge */}
      <div className="perf mx-3 mt-0" />

      {/* zone 1 — header */}
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-3">
          GiftProof · receipt
        </span>
        <span className="font-mono text-[10px] tabular-nums text-ink-3">#{pick.rankPosition}</span>
      </div>

      {/* zone 2 — the drawn bridge (the leap) */}
      <div className="mx-3 rounded-[5px] border border-[var(--ink-06)] bg-paper px-1.5 py-1.5">
        <Bridge explain={pick.explain} target={pick.name} domain={pick.type} id={pick.entityId} animate={animate} />
      </div>

      {/* zone 3 — the cite-ribbon (band-colored 2px top rule, R4) */}
      <div
        className="mt-2.5 grid grid-cols-1 gap-px border-t-2 bg-[var(--hair)] sm:grid-cols-2"
        style={{ borderTopColor: bandHue }}
      >
        <div className={`flex flex-col gap-1.5 bg-paper-2 px-3 py-2.5 ${animate ? "clause-reveal" : ""}`}
             style={{ animationDelay: "0.34s" }}>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-accent-ink">Qloo says</span>
          <p className="font-display text-[13px] leading-snug text-ink">{qlooSays.rankStatement}</p>
          <p className="font-mono text-[10px] tabular-nums text-ink-3">{qlooSays.affinityBand}</p>
          {qlooSays.topContributors.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {qlooSays.topContributors.map((c) => (
                <span
                  key={c}
                  className="rounded-[4px] border border-[var(--ink-08)] bg-paper px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2"
                >
                  § {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={`flex flex-col gap-1.5 bg-paper-2 px-3 py-2.5 ${animate ? "clause-reveal" : ""}`}
             style={{ animationDelay: "0.42s" }}>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-accent-ink">We chose</span>
          <p className="font-display text-[13px] leading-snug text-ink">{weChose.reason}</p>
          {/* match-type is a PROVENANCE category, NOT an affinity band — so it uses the accent/ink role
              ladder, never the DATA-ONLY band hues (critic W1 / R2: one hue = one meaning). Hierarchy
              by FILL (exact = accent fill, semantic = quiet ink ghost), not by borrowing the palette. */}
          <span
            className="mt-auto inline-flex w-fit items-center gap-1 rounded-[4px] border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]"
            style={{
              color: exact ? "var(--color-accent-ink)" : "var(--color-ink-3)",
              borderColor: exact ? "var(--accent-20)" : "var(--ink-12)",
              background: exact ? "var(--accent-08)" : "transparent",
            }}
          >
            {exact ? "exact" : "semantic"} match
          </span>
        </div>
      </div>

      <details className="group border-t border-[var(--hair)] px-3 py-1.5">
        <summary className="cursor-pointer select-none font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-ink">
          raw Qloo response
        </summary>
        <pre tabIndex={0} role="region" aria-label="Raw Qloo response for this pick" className="mt-2 max-h-64 overflow-auto rounded-[5px] bg-paper-sink p-3 font-mono text-[10px] leading-relaxed text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-20)]">
          {JSON.stringify(qlooSays.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}
