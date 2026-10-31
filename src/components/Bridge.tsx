// File: src/components/Bridge.tsx
// The cross-domain leap, DRAWN (SELECTION D2 / SIGNATURE-SPEC §bridge). Connectors from the real
// Qloo explainability contributors (left) to this pick (right). Stroke-weight ∝ REAL explain[].score
// — the ONLY place a score drives geometry, and it is Qloo's number. When score is null the strand is
// a flat hairline labelled "rank-band" (NO fabricated weight — NN-3). The strands DRAW on mount
// (stroke-dashoffset), so a React key change on swap re-plays the re-bridge (the signature "oh").
import type { ExplainContribution, QlooEntityType } from "@/lib/types";

const domainLabel = (d: QlooEntityType) => d.replace("urn:entity:", "").replace(/_/g, " ");

export function Bridge({
  explain,
  target,
  domain,
  id,
  animate = true,
}: {
  explain: ExplainContribution[];
  target: string;
  domain: QlooEntityType;
  id?: string; // stable unique id (pick.entityId) for the clipPath
  animate?: boolean;
}) {
  const rows = explain.slice(0, 3);
  if (rows.length === 0) return null;

  const W = 300;
  const H = Math.max(64, rows.length * 30 + 18);
  const leftX = 8;
  const convergeX = W - 98; // where strands meet the gift node (leaves room for the image + label)
  const midY = H / 2;
  const rowY = (i: number) => 18 + i * 30;
  // the REAL image of the gift lands AT the end of the leap (owner: show the thumbnail here).
  const clipId = `thumb-${(id || target).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  const thumbUrl = `/api/thumb?type=${encodeURIComponent(domain)}&q=${encodeURIComponent(target)}`;
  const NODE = 34; // plate size

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="block"
      role="img"
      aria-label={`Qloo linked ${rows.map((r) => r.label).join(", ")} to this ${domainLabel(domain)} pick`}
    >
      {rows.map((r, i) => {
        const y = rowY(i);
        const hasScore = r.score !== null;
        const sw = hasScore ? 1 + Math.min(1, (r.score as number) / 0.4) * 4 : 1;
        const d = `M ${leftX + 56} ${y} C ${W * 0.42} ${y}, ${W * 0.52} ${midY}, ${convergeX - NODE / 2} ${midY}`;
        return (
          <g key={`${r.entityId}-${r.label}`}>
            <title>{`${r.label}${hasScore ? ` — correlation ${(r.score as number).toFixed(2)}` : " — rank-band"}`}</title>
            <path
              d={d}
              fill="none"
              stroke={hasScore ? "var(--color-accent)" : "var(--ink-20)"}
              strokeWidth={sw}
              strokeLinecap="round"
              opacity={hasScore ? 0.8 : 0.55}
              className={animate ? "strand-draw" : undefined}
              style={{ ["--len" as string]: 240, animationDelay: `${0.12 + i * 0.09}s` }}
            />
            <text x={leftX} y={y + 3} className="font-mono" fontSize="9.5" fill="var(--color-ink-2)">
              {r.label.length > 10 ? r.label.slice(0, 9) + "…" : r.label}
            </text>
            {hasScore && (
              <text x={leftX + 56} y={y - 5} className="font-mono" fontSize="8" fill="var(--color-accent-ink)">
                {(r.score as number).toFixed(2)}
              </text>
            )}
          </g>
        );
      })}
      {/* the gift node (right) — the real image of the gift, where the cross-domain leap lands */}
      <defs>
        <clipPath id={clipId}>
          <rect x={convergeX - NODE / 2} y={midY - NODE / 2} width={NODE} height={NODE} rx="7" />
        </clipPath>
      </defs>
      {/* plate + fallback dot (shown through if the image 404s → honest, never a broken placeholder) */}
      <rect
        x={convergeX - NODE / 2}
        y={midY - NODE / 2}
        width={NODE}
        height={NODE}
        rx="7"
        fill="var(--color-paper)"
        stroke="var(--hair)"
      />
      <circle cx={convergeX} cy={midY} r="3.5" fill="var(--color-accent)" opacity="0.5" />
      <image
        href={thumbUrl}
        x={convergeX - NODE / 2 + 3}
        y={midY - NODE / 2 + 3}
        width={NODE - 6}
        height={NODE - 6}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid meet"
      />
      <text
        x={convergeX + NODE / 2 + 7}
        y={midY + 2}
        className="font-mono"
        fontSize="9.5"
        fill="var(--color-ink)"
        fontWeight="600"
      >
        {target.length > 10 ? target.slice(0, 9) + "…" : target}
      </text>
      <text x={convergeX + NODE / 2 + 7} y={midY + 13} className="font-mono" fontSize="7.5" fill="var(--color-ink-3)">
        {domainLabel(domain)}
      </text>
    </svg>
  );
}
