// File: src/components/PressRunStepper.tsx
// The agent made visible as a PRESS RUN (SELECTION §4) — not a grey text row. Steps:
// chosen domains → per-domain fan-out legs (Qloo's REAL returned counts + top affinity) → the refine
// hop (fired = an extra stamped step; skipped = a dashed step). Every number is from AgentTrace
// (types.ts) — nothing fabricated. Renders nothing when no trace is present.
import type { AgentTrace as AgentTraceData, QlooEntityType } from "@/lib/types";

const label = (d: QlooEntityType) => d.replace("urn:entity:", "").replace(/_/g, " ");

export function PressRunStepper({ agent }: { agent?: AgentTraceData }) {
  if (!agent) return null;
  const { chosenDomains, reasoning, recipient, fanout, refine, qlooCallCount } = agent;
  const demo = [
    recipient.age ? `age ${recipient.age.replace(/_/g, " ")}` : null,
    recipient.gender,
    recipient.place,
  ].filter(Boolean) as string[];

  return (
    <section
      aria-label="Agent press run"
      className="flex flex-col gap-3 rounded-[9px] border border-[var(--hair)] bg-paper-2 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink">Press run</span>
        <span className="font-mono text-[10px] text-ink-3">the 0G agent reasoned, then called Qloo</span>
        {qlooCallCount > 0 && (
          <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-3">
            {qlooCallCount} Qloo calls
          </span>
        )}
      </div>

      {reasoning && (
        <p className="font-display text-[14px] leading-snug text-ink-2">
          <span className="text-accent-ink">“</span>{reasoning}<span className="text-accent-ink">”</span>
        </p>
      )}

      {/* step 1 — chosen domains */}
      <ol className="flex flex-col gap-2.5">
        <Step n={1} title="Chose gift domains">
          <div className="flex flex-wrap gap-1.5">
            {chosenDomains.map((d) => (
              <span
                key={d}
                className="rounded-[5px] border border-[var(--ink-10)] bg-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink"
              >
                {label(d)}
              </span>
            ))}
          </div>
        </Step>

        {/* step 2 — the parallel fan-out */}
        {fanout.length > 0 && (
          <Step n={2} title="Fanned out, one Qloo call per domain">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {fanout.map((f) => (
                <div
                  key={f.domain}
                  className="flex items-center justify-between gap-2 rounded-[5px] bg-paper px-2 py-1 font-mono text-[10px] text-ink-2"
                >
                  <span className="uppercase tracking-[0.08em]">{label(f.domain)}</span>
                  <span className="tabular-nums text-ink-3">
                    {f.returned} picks
                    {f.topAffinity !== null ? ` · top ${f.topAffinity.toFixed(2)}` : " · rank-band"}
                  </span>
                </div>
              ))}
            </div>
            {demo.length > 0 && (
              <p className="pt-1 font-mono text-[10px] text-ink-3">
                recipient signals sent: <span className="text-ink-2">{demo.join(", ")}</span>
              </p>
            )}
          </Step>
        )}

        {/* step 3 — refine hop */}
        <Step n={3} title="Refine loop" fired={refine.fired} skipped={!refine.fired}>
          <p className="font-mono text-[10px] text-ink-2">
            {refine.fired
              ? `fired — ${refine.reason}${refine.addedTags.length ? ` · added ${refine.addedTags.join(", ")}` : ""}`
              : "skipped — the first ranking was sharp"}
          </p>
        </Step>
      </ol>
    </section>
  );
}

function Step({
  n,
  title,
  children,
  fired,
  skipped,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  fired?: boolean;
  skipped?: boolean;
}) {
  return (
    // demonstrative reveal: each step prints in sequence, so the agent's reasoning plays out
    <li className="reveal-up flex gap-3" style={{ ["--d" as string]: `${0.12 + n * 0.12}s` }}>
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] tabular-nums"
        style={
          skipped
            ? { border: "1.5px dashed var(--ink-20)", color: "var(--color-ink-3)" }
            : fired
            ? { background: "var(--color-accent)", color: "white" }
            : { background: "var(--color-ink)", color: "var(--color-paper)" }
        }
      >
        {skipped ? "–" : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">{title}</span>
        {children}
      </div>
    </li>
  );
}
