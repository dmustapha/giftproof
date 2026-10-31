// File: src/components/BandChip.tsx
// The affinity rank-band as ONE warm state-language: hue + shape + UPPERCASE label, always together
// (SELECTION R4 band-chip = NN-3 made physical). NEVER a filled bar / gauge. Shows the REAL affinity
// figure when Qloo returned one, else the rank-band label — never a fabricated percentage.
import type { QlooPick } from "@/lib/types";

const BAND = {
  high: { hue: "var(--color-band-high)", glyph: "▲▲", label: "HIGH" },
  medium: { hue: "var(--color-band-medium)", glyph: "▲", label: "MEDIUM" },
  low: { hue: "var(--color-band-low)", glyph: "●", label: "LOW" },
} as const;

export function BandChip({ pick, size = "md" }: { pick: QlooPick; size?: "sm" | "md" }) {
  const b = BAND[pick.rankBand];
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[5px] border-l-[3px] font-mono uppercase tracking-[0.12em] ${pad}`}
      style={{
        color: b.hue,
        borderLeftColor: b.hue,
        background: `color-mix(in oklch, ${b.hue} 13%, transparent)`,
      }}
      title={pick.affinity !== null ? `real Qloo affinity ${pick.affinity.toFixed(4)}` : "rank-band only (no affinity returned)"}
    >
      <span aria-hidden className="leading-none">{b.glyph}</span>
      <span className="font-semibold">{b.label}</span>
      <span className="opacity-40">·</span>
      {pick.affinity !== null ? (
        <span className="tabular-nums tracking-normal">{pick.affinity.toFixed(2)}</span>
      ) : (
        <span className="tracking-normal normal-case opacity-70">rank #{pick.rankPosition}</span>
      )}
    </span>
  );
}
